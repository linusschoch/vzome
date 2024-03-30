
import { createContext, createEffect, createMemo, createSignal, onMount, useContext } from "solid-js";
import { Vector3, Matrix4, BufferGeometry, Float32BufferAttribute } from "three";
import { useThree } from "solid-three";

import { useInteractionTool } from "./context/interaction.jsx";
import { useViewer } from "./context/viewer.jsx";
import { useCamera } from "./context/camera.jsx";

import { GLTFExporter } from "three-stdlib";
import { Label } from "./labels.jsx";


const Instance = ( props ) =>
{
  let meshRef, linesRef;
  createEffect( () => {
    const m = new Matrix4();
    m.set( ...props.rotation );
    meshRef.matrix = m;
    if ( !! linesRef )
      linesRef.matrix = m.clone();
  } );

  const [ tool ] = useInteractionTool();

  const handleHover = value => e =>
  {
    const handler = tool && tool() ?.onHover;
    if ( handler ) {
      e.stopPropagation();
      handler( props.id, props.position, props.type, value );
    }
  }
  const handleContextMenu = ( e ) =>
  {
    const handler = tool && tool() ?.onContextMenu;
    if ( handler ) {
      e.stopPropagation();
      handler( props.id, props.position, props.type, props.selected, props.label )
    }
  }
  const handlePointerDown = ( e ) =>
  {
    if ( e.button !== 0 ) // left-clicks only, please
      return;
    const handler = tool && tool() ?.onDragStart;
    if ( handler ) {
      e.stopPropagation()
      handler( props.id, props.position, props.type, props.selected, e )
    }
  }
  const handlePointerUp = ( e ) =>
  {
    if ( e.button !== 0 ) // left-clicks only, please
      return;
    let handler = tool && tool() ?.onDragEnd;
    if ( handler ) {
      e.stopPropagation()
      handler( props.id, props.position, props.type, props.selected, e )
    }
    handler = tool && tool() ?.onClick;
    if ( handler ) {
      e.stopPropagation()
      handler( props.id, props.position, props.type, props.selected, props.label )
    }
  }

  onMount( () => linesRef && linesRef.layers.set( 4 ) );

  // TODO give users control over emissive color
  const emissive = () => props.selected? "#c8c8c8" : "black"
  // TODO: cache materials
  return (
    <group position={ props.position } name={props.id} >
      <mesh matrixAutoUpdate={false} ref={meshRef} geometry={props.geometry}
          onPointerOver={handleHover(true)} onPointerOut={handleHover(false)}
          onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onContextMenu={handleContextMenu}>
        <meshLambertMaterial attach="material" color={props.color} emissive={emissive()} />
      </mesh>
      { !!props.outlineGeometry &&
        <lineSegments matrixAutoUpdate={false} ref={linesRef} geometry={props.outlineGeometry} >
          <lineBasicMaterial attach="material" linewidth={4.4} color='black' />
        </lineSegments>
      }
      {!!props.label && <Label parent={meshRef} position={props.geometry.shapeCentroid} text={props.label} />}
    </group>
  )
}

const centroid = vertices =>
{
  let [ sx, sy, sz ] = [ 0,0,0 ];
  vertices .forEach( ({ x, y, z }) => {
    sx += x; sy += y; sz += z;
  });
  const num = vertices .length;
  return { x: sx/num, y: sy/num, z: sz/num };
}

const InstancedShape = ( props ) =>
{
  const { scene } = useViewer();
  const showOutlines = () => scene.polygons;

  const geometry = createMemo( () =>
  {
    // TODO: use indexed vertices, if I can understand how to do normals
    const { vertices, faces } = props.shape;
    const computeNormal = ( [ v0, v1, v2 ] ) => {
      const e1 = new Vector3().subVectors( v1, v0 )
      const e2 = new Vector3().subVectors( v2, v0 )
      return new Vector3().crossVectors( e1, e2 ).normalize()
    }
    let positions = [];
    let normals = [];
    faces.forEach( face => {
      const corners = face.vertices.map( i => vertices[ i ] )
      const { x:nx, y:ny, z:nz } = computeNormal( corners )
      const addVertex = ( { x, y, z } ) =>
      {
        positions.push( x, y, z );
        normals.push( nx, ny, nz )
      }
      if ( scene.polygons ) {
        for (let index = 0; index < corners.length-2; index++) {
          addVertex( corners[ 0 ] );
          addVertex( corners[ (index+1) % corners.length ] );
          addVertex( corners[ (index+2) % corners.length ] );
        }  
      } else {
        corners.forEach( addVertex );
      }
    } );
    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
    geometry.setAttribute( 'normal', new Float32BufferAttribute( normals, 3 ) );
    geometry.computeBoundingSphere();
    geometry.shapeCentroid = centroid( vertices );
    return geometry;
  } );

  const outlineGeometry = createMemo( () =>
  {
    const { vertices, faces } = props.shape;
    let positions = [];
    vertices .map( ( { x, y, z } ) => positions.push( x, y, z ) );
    let indices = [];
    faces.forEach( face => {
      for (let i = 0; i < face.vertices.length; i++) {
        indices .push( face.vertices[ i ] );
        indices .push( face.vertices[ (i+1) % face.vertices.length ] );
      }
    } );
    const geometry = new BufferGeometry();
    geometry .setIndex( indices );
    geometry .setAttribute( 'position', new Float32BufferAttribute( positions, 3 ) );
    geometry .computeBoundingSphere();
    return geometry;
  } );

  return (
    <>
      <For each={props.shape.instances}>{ instance =>
        <Instance {...instance} geometry={geometry()} outlineGeometry={ showOutlines() && outlineGeometry() } />
      }</For>
    </>
  )
}

export const ShapedGeometry = ( props ) =>
{
  const scene = useThree(({ scene }) => scene);
  const exportGltf = callback => {
    const exporter = new GLTFExporter();
    // Parse the input and generate the glTF output
    exporter.parse( scene(), callback, { onlyVisible: false } );
  };
  const { setExporter } = useContext( GltfExportContext );
  setExporter( { exportGltf } );

  let groupRef;
  createEffect( () => {
    if ( props.embedding && groupRef && groupRef.matrix ) {
      const m = new Matrix4()
      m.set( ...props.embedding )
      m.transpose()
      groupRef.matrix.identity()  // Required, or applyMatrix4() changes will accumulate
      // This imperative approach is required because I was unable to decompose the
      //   embedding matrix (a shear) into a scale and rotation.
      groupRef.applyMatrix4( m );
    }
  })
  return (
    // <Show when={ () => props.shapes }>
      <group matrixAutoUpdate={false} ref={groupRef} >
        <For each={Object.values( props.shapes || {} )}>{ shape =>
          <InstancedShape shape={shape} />
        }</For>
      </group>
    // </Show>
  )
};

const GltfExportContext = createContext( { setExporter: ()=>{}, exporter: ()=>{} } );

export const GltfExportProvider = (props) =>
{
  const [ exporter, setExporter ] = createSignal( {} );

  return (
    <GltfExportContext.Provider value={ { exporter, setExporter } }>
      {props.children}
    </GltfExportContext.Provider>
  );
}

export const useGltfExporter = () => { return useContext( GltfExportContext ); };
