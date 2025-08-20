
import { createEffect } from 'solid-js';
import { createStore } from 'solid-js/store';

import Stack from "@suid/material/Stack";
import { Tooltip } from "@kobalte/core/tooltip";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";

import { useEditor } from '../../framework/context/editor.jsx';
import { useSymmetry } from "../context/symmetry.jsx";
import { useWorkerClient } from '../../../viewer/context/worker.jsx';
import { CameraProvider, useCamera } from '../../../viewer/context/camera.jsx';
import { InteractionToolProvider } from '../../../viewer/context/interaction.jsx';
import { SceneCanvas } from '../../../viewer/scenecanvas.jsx';

import { SnapCameraTool } from '../tools/snapcamera.jsx';
import { ImageCaptureProvider } from '../../../viewer/context/export.jsx';
import { ZoomSlider } from './zoomslider.jsx';


export const CameraControls = (props) =>
{
  const context = useCamera();
  const { isWorkerReady, subscribeFor } = useWorkerClient();
  const { rootController, controllerAction } = useEditor();
  const { state, setCamera, togglePerspective, toggleOutlines } = useCamera();
  const { snapping, toggleSnapping } = useSymmetry();
  const [ scene, setScene ] = createStore( null );

  const isPerspective = () => state.camera.perspective;

  // Camera view presets
  const preset = (lookDir, up) => () => {
    const { distance, lookAt } = state.camera;
    const goal = { distance, lookAt, lookDir, up };
    context.tweenCamera(goal);
  };

  // TODO: encapsulate these and createStore() in a new createScene()... 
  //  OR...
  //  Now that worker and canvas are decoupled, we could just use a separate worker for the trackball scene?!
  const addShape = ( shape ) =>
  {
    if ( ! scene .shapes ) {
      setScene( 'shapes', {} );
    }
    if ( ! scene ?.shapes[ shape.id ] ) {
      setScene( 'shapes', shape.id, shape );
      return true;
    }
    return false;
  }
  const updateShapes = ( shapes ) =>
  {
    for (const [id, shape] of Object.entries(shapes)) {
      if ( ! addShape( shape ) ) {
        // shape is not new, so just replace its instances
        setScene( 'shapes', id, 'instances', shape.instances );
      }
    }
    // clean up preview strut, which may be a shape otherwise not in the scene
    for ( const id of Object.keys( scene ?.shapes || {} ) ) {
      if ( ! (id in shapes) )
      setScene( 'shapes', id, 'instances', [] );
    }
  }

  subscribeFor( 'TRACKBALL_SCENE_LOADED', ( scene ) => {
    if ( scene.camera ) {
      const { lookAt, distance, near, far, width } = state.camera;  // This looks circular, but it is not reactive code.
      // Ignore the rotation from the loaded scene.
      setCamera( { lookAt, distance, near, far, width } );
    }
    setScene( 'embedding', scene.embedding );
    updateShapes( scene.shapes );
  });

  // const scene = () => {
  //   let { camera, lighting, ...other } = state.trackballScene;
  //   const { camera: { lookDir, up }, lighting: { backgroundColor } } = state.scene;
  //   camera = { ...camera, lookDir, up }; // override just the orientation
  //   lighting = { ...lighting, backgroundColor }; // override just the background
  //   return ( { ...other, camera, lighting } );
  // }

  // A special action that will result in TRACKBALL_SCENE_LOADED being sent
  createEffect( () => isWorkerReady() && controllerAction( rootController(), 'connectTrackballScene' ) );

  return (
    <ImageCaptureProvider> {/* We need this just so we don't set the main capturer from this GL context */}
    <InteractionToolProvider>
      {/* provider and CameraTool just to get the desired cursor */}
      <SnapCameraTool/>
      <div id='camera-controls'>
        <div class='segmented'>
          <div class='segmented__label'>View</div>
          <div role='group' aria-label='View options' class='segmented__group'>
            <Tooltip openDelay={400} closeDelay={100}>
              <Tooltip.Trigger>
                <button type='button'
                        class='segmented__button'
                        aria-pressed={isPerspective() ? 'true' : 'false'}
                        onClick={togglePerspective}>
                  Perspective
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class='rt-content' gutter={8}>
                  <div class='rt-title'><span class='rt-name'>Perspective</span></div>
                  <div class='rt-help'>Toggle perspective vs. orthographic camera.</div>
                  <Tooltip.Arrow />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>

            <Tooltip openDelay={400} closeDelay={100}>
              <Tooltip.Trigger>
                <button type='button'
                        class='segmented__button'
                        aria-pressed={snapping() ? 'true' : 'false'}
                        onClick={toggleSnapping}>
                  Snap
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class='rt-content' gutter={8}>
                  <div class='rt-title'><span class='rt-name'>Snap</span></div>
                  <div class='rt-help'>Snap trackball rotations to symmetry.</div>
                  <Tooltip.Arrow />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>

            <Tooltip openDelay={400} closeDelay={100}>
              <Tooltip.Trigger>
                <button type='button'
                        class='segmented__button'
                        aria-pressed={state.outlines ? 'true' : 'false'}
                        onClick={toggleOutlines}>
                  Outlines
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class='rt-content' gutter={8}>
                  <div class='rt-title'><span class='rt-name'>Outlines</span></div>
                  <div class='rt-help'>Show or hide model outlines.</div>
                  <Tooltip.Arrow />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>

          </div>
          <div style={{"margin-left":"8px", display:"inline-flex", gap: "6px"}}>
            {/* Presets dropdown (moved outside segmented group for visibility) */}
            <DropdownMenu>
              <DropdownMenu.Trigger class="segmented__button" aria-label="View presets">Presets ▾</DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="dropdown-menu__content">
                  <DropdownMenu.Item class="dropdown-menu__item" onSelect={preset([0,0,-1],[0,1,0])}>Front</DropdownMenu.Item>
                  <DropdownMenu.Item class="dropdown-menu__item" onSelect={preset([0,-1,0],[0,0,-1])}>Top</DropdownMenu.Item>
                  <DropdownMenu.Item class="dropdown-menu__item" onSelect={preset([1,0,0],[0,1,0])}>Right</DropdownMenu.Item>
                  <DropdownMenu.Item class="dropdown-menu__item" onSelect={preset([1,-1,-1].map(v=>v/Math.sqrt(3)),[0,1,0])}>Isometric</DropdownMenu.Item>
                  <DropdownMenu.Arrow />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu>
            <Tooltip openDelay={400} closeDelay={100}>
              <Tooltip.Trigger>
                <button type='button' class='segmented__button' onClick={context.resetCamera}>Reset</button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content class='rt-content' gutter={8}>
                  <div class='rt-title'><span class='rt-name'>Reset view</span><span class='rt-shortcut'>R</span></div>
                  <div class='rt-help'>Restore the default camera and lighting.</div>
                  <Tooltip.Arrow />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip>
          </div>
        </div>

        <div id="ball-and-slider">
          <div id="camera-trackball">
            <CameraProvider name='trackball' outlines={false} context={context}>
              <SceneCanvas scene={scene} height="200px" width="240px" rotationOnly={true} rotateSpeed={0.7}/>
            </CameraProvider>
          </div>
          <div id='zoom-slider' >
            <ZoomSlider/>
          </div>
        </div>
      </div>
    </InteractionToolProvider>
    </ImageCaptureProvider>
  )
}
