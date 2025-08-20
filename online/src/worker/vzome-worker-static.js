
import { resourceIndex, importLegacy, importZomic } from '../revision.js';
import { commitToGitHub, assemblePartsList, normalizePreview } from '../both-contexts.js';

// const uniqueId = Math.random();

// support trampolining to work around worker CORS issue
//   see https://github.com/evanw/esbuild/issues/312#issuecomment-1025066671
export const WORKER_ENTRY_FILE_URL = import.meta.url;

let baseURL;

let design = {}

const IDENTITY_MATRIX = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];

export const DEFAULT_SNAPSHOT = -1;

// Normalize legacy scenes to match preview scenes
const prepareDefaultScene = design =>
{
  const camera = design.rendered.camera;
  design.rendered.scenes .splice( 0, 0, { title: 'default scene', camera, snapshot: DEFAULT_SNAPSHOT } );
}

// Take a normalized scene and prepare it to send to the client, by
//   resolving the shapes and snapshot
// TODO: change the client contract to avoid sending shapes and rotation matrices all the time!
const prepareSceneResponse = ( design, sceneIndex ) =>
{
  let scene = { ...design.rendered.scenes[ sceneIndex ] };
  if ( typeof scene.snapshot === "undefined" ) {
    console.log( `warning: no scene with index ${sceneIndex}` );
    scene = { ...design.rendered.scenes[ 0 ] };
  }
  const { title, snapshot, camera } = scene;
  const { embedding, polygons, instances, snapshots, orientations, lighting } = design.rendered;
  const sceneInstances = ( snapshot === DEFAULT_SNAPSHOT )? instances : snapshots[ snapshot ];
  const shapes = {};
  for ( const instance of sceneInstances ) {
    const rotation = [ ...( orientations[ instance.orientation ] || IDENTITY_MATRIX ) ];
    if ( ! shapes[ instance.shapeId ] ) {
      shapes[ instance.shapeId ] = { ...design.rendered.shapes[ instance.shapeId ], instances: [] };
    }
    shapes[ instance.shapeId ].instances.push( { ...instance, rotation } );
  }
  return { title, shapes, camera, lighting, embedding, polygons };
}

// Provide safe fallbacks for camera & lighting to avoid serialization errors when partially initialized
const safeRenderConfig = ( rendered ) => {
  const camera = { near: 0.01, far: 1000, width: 4, distance: 40, perspective: true, lookAt: [0,0,0], lookDir: [0,0,-1], up: [0,1,0], ...( rendered?.camera || {} ) };
  const lighting = { ambientColor: '#777777', backgroundColor: '#ffffff', directionalLights: [], ...( rendered?.lighting || {} ) };
  // normalize any directional lights missing color
  lighting.directionalLights = (lighting.directionalLights||[]).map( dl => ({ color: dl.color || '#888888', direction: dl.direction || [0,0,1] }) );
  return { camera, lighting };
}

const prepareEditSceneResponse = ( design, edit, before ) =>
  {
    let sceneInstances = design.wrapper .getScene( edit, before );

    if ( ! sceneInstances ) {
      // debugging, so we have to interpret more
      edit = design.wrapper .interpretToBreakpoint( edit, before );
      sceneInstances = design.wrapper .getScene( edit, before );
    }

    sceneInstances = { ...sceneInstances }; 
    const { polygons, orientations } = design.rendered;
    const shapes = {};
    for ( const instance of Object.values( sceneInstances ) ) {
      const rotation = [ ...( orientations[ instance.orientation ] || IDENTITY_MATRIX ) ];
      if ( ! shapes[ instance.shapeId ] ) {
        shapes[ instance.shapeId ] = { ...design.rendered.shapes[ instance.shapeId ], instances: [] };
      }
      shapes[ instance.shapeId ].instances.push( { ...instance, rotation } );
    }
    return { scene: { shapes, polygons }, edit };
  }
  
const filterScene = ( report, load ) => event =>
{
  const { type, payload } = event;
  if ( type === 'SCENE_RENDERED' ) {
    const { camera, lighting, shapes, embedding, polygons } = payload.scene;
    event.payload.scene = { shapes, embedding, polygons };
    if ( load.camera )   event.payload.scene.camera   = camera;
    if ( load.lighting ) event.payload.scene.lighting = lighting;

    if ( load.bom ) {
      partsPromise .then( ({ colors }) => {
        const bom = assemblePartsList( shapes, colors );
        report( { type: 'BOM_CHANGED', payload: bom } );
      });
    }
  }
  report( event );
}

const getSceneIndex = ( title, list ) =>
{
  if ( !title )
    return 0;
  let index;
  if ( title.startsWith( '#' ) ) {
    const indexStr = title.substring( 1 );
    index = parseInt( indexStr );
    if ( isNaN( index ) || index < 0 || index > list.length ) {
      console.log( `WARNING: ${index} is not a scene index` );
      index = 0;
    }
  } else {
    index = list .map( s => s.title ) .indexOf( title );
    if ( index < 0 ) {
      console.log( `WARNING: no scene titled "${title}"` );
      index = 0;
    }
  }
  return index;
}
const fetchUrlText = async ( url ) =>
{
  let response;
  try {
    response = await fetch( url )
  } catch ( error ) {
    console.log( `Fetching ${url} failed with "${error}"; trying cors-anywhere` )
    // TODO: I should really deploy my own copy of this proxy on Heroku
    response = await fetch( 'https://cors-anywhere.herokuapp.com/' + url )
  }
  if ( !response.ok ) {
    throw new Error( `Failed to fetch "${url}": ${response.statusText}` )
  }
  return response.text()
}

const fetchFileText = selected =>
{
  const temporaryFileReader = new FileReader()

  return new Promise( (resolve, reject) => {
    temporaryFileReader.onerror = () => {
      temporaryFileReader.abort()
      reject( temporaryFileReader.error )
    }

    temporaryFileReader.onload = () => {
      resolve( temporaryFileReader.result )
    }
    temporaryFileReader.readAsText( selected )
  })
}

// Fetch the official Zometool colors
const parts_catalog_url = 'https://zometool.github.io/vzome-sharing/metadata/zometool-parts.json';
const partsPromise = fetch( parts_catalog_url ) .then( response => response.text() ) .then( text => JSON.parse( text ) );

const clientEvents = report =>
{
  const sceneChanged = ( scene, edit='--START--' ) => report( { type: 'SCENE_RENDERED', payload: { scene, edit } } );

  const shapeDefined = shape => report( { type: 'SHAPE_DEFINED', payload: shape } );

  const instanceAdded = instance => report( { type: 'INSTANCE_ADDED', payload: instance } );

  const latestBallAdded = instance => report( { type: 'LAST_BALL_CREATED', payload: instance } );

  const instanceRemoved = ( shapeId, id ) => report( { type: 'INSTANCE_REMOVED', payload: { shapeId, id } } );

  const selectionToggled = ( shapeId, id, selected ) => report( { type: 'SELECTION_TOGGLED', payload: { shapeId, id, selected } } );

  const symmetryChanged = details => report( { type: 'SYMMETRY_CHANGED', payload: details } );

  const xmlParsed = xmlTree => report( { type: 'DESIGN_XML_PARSED', payload: xmlTree } );

  const propertyChanged = ( controllerPath, name, value ) => report( { type: 'CONTROLLER_PROPERTY_CHANGED', payload: { controllerPath, name, value } } );

  const errorReported = message => report( { type: 'ALERT_RAISED', payload: message } );

  const scenesDiscovered = s => report( { type: 'SCENES_DISCOVERED', payload: s } );

  const textExported = ( action, text ) => report( { type: 'TEXT_EXPORTED', payload: { action, text } } ) ;

  const buildPlaneSelected = ( center, diskZone, hingeZone ) => report( { type: 'PLANE_CHANGED', payload: { center, diskZone, hingeZone } } );

  return { sceneChanged, shapeDefined, instanceAdded, instanceRemoved, selectionToggled, symmetryChanged, latestBallAdded,
    xmlParsed, scenesDiscovered, propertyChanged, errorReported, textExported, buildPlaneSelected, };
}

const trackballScenes = {};

const fetchTrackballScene = ( url, report, polygons ) =>
{
  const reportTrackballScene = scene => report( { type: 'TRACKBALL_SCENE_LOADED', payload: scene } );
  const cachedScene = trackballScenes[ url ];
  if ( !!cachedScene ) {
    reportTrackballScene( cachedScene );
    return;
  }
  Promise.all( [ importLegacy(), fetchUrlText( new URL( `/app/classic/resources/${url}`, baseURL ) ) ] )
    .then( ([ legacy, xml ]) => {
      const trackballDesign = legacy .loadDesign( xml, false, polygons, clientEvents( ()=>{} ) );
      prepareDefaultScene( trackballDesign );
      const scene = prepareSceneResponse( trackballDesign, 0 ); // takes a normalized scene
      trackballScenes[ url ] = scene;
      reportTrackballScene( scene );
    } );
}

const connectTrackballScene = ( report, polygons ) =>
{
  // console.log( "call", uniqueId );
  const trackballUpdater = () => fetchTrackballScene( design.wrapper .getTrackballUrl(), report, polygons );
  trackballUpdater();
  design.wrapper.controller .addPropertyListener( { propertyChange: pce =>
  {
    if ( 'symmetry' === pce.getPropertyName() ) { trackballUpdater(); }
  } });
}

const createDesign = async ( report, fieldName ) =>
{
  report( { type: 'FETCH_STARTED', payload: { name: 'untitled.vZome', preview: false } } );
  try {
    const legacy = await importLegacy();
    report({ type: 'CONTROLLER_CREATED' }); // do we really need this for previewing?
    design = legacy .newDesign( fieldName, clientEvents( report ) );
    prepareDefaultScene( design );
    reportDefaultScene( report );
  } catch (error) {
    console.log(`createDesign failure: ${error.message}`);
    report({ type: 'ALERT_RAISED', payload: 'Failed to create vZome model.' });
    return false;
  }
}

const openDesign = async ( xmlLoading, name, report, debug, polygons, sceneTitle ) =>
{
  const events = clientEvents( report );
  return Promise.all( [ importLegacy(), xmlLoading ] )

    .then( ([ legacy, xml ]) => {
      if ( !xml ) {
        report( { type: 'ALERT_RAISED', payload: 'Unable to load .vZome content' } );
        return;
      }
      const doLoad = () => {
        report( { type: 'CONTROLLER_CREATED' } ); // do we really need this for previewing?
        design = legacy .loadDesign( xml, debug, polygons, events );
        prepareDefaultScene( design );

        // TODO: don't duplicate this in urlLoader()
        const sceneIndex = sceneTitle? getSceneIndex( sceneTitle, design.rendered.scenes ) : 0;
        if ( design.rendered.scenes.length >= 2 )
          events .scenesDiscovered( design.rendered.scenes .map( ({ title, camera }) => ({ title, camera }) ) ); // strip off snapshot
        events .sceneChanged( prepareSceneResponse( design, sceneIndex ) );

        report( { type: 'TEXT_FETCHED', payload: { text: xml, name } } ); // NOW it is safe to send the name
      }
      if ( xml .includes( 'Zomic' ) ) {
        importZomic() .then( (zomic) => {
          const field = legacy .getField( 'golden' );
          field .setInterpreterModule( zomic, legacy .vzomePkg );
          doLoad();
        })
        .catch( error => {
          console.log( `openDesign failure: ${error.message}` );
          report( { type: 'ALERT_RAISED', payload: `Failed to load vZome model: ${error.message}` } );
         } );
      }
      else
        doLoad();
    } )

    .catch( error => {
      console.log( `openDesign failure: ${error.message}` );
      report( { type: 'ALERT_RAISED', payload: `Failed to load vZome model: ${error.message}` } );
     } );
}

const exportPreview = ( camera, lighting ) =>
{
  const { scenes, ...rest } = design.rendered;
  scenes[ 0 ] .camera = camera;
  const rendered = { ...rest, scenes, lighting, format: 'online' };
  return JSON.stringify( rendered, null, 2 );
}

const shareToGitHub = async ( target, config, data, report ) =>
{
  const { orgName, repoName, branchName } = target;
  const { title, description, blog, publish, style, originalDate } = config;
  const { name, camera, lighting, image } = data;
  const preview = exportPreview( camera, lighting );
  importLegacy()
    .then( module => {
      const xml = design.wrapper .serializeVZomeXml( lighting, camera );
      const creation = ( originalDate || new Date() ) .toISOString();
      const date = creation .substring( 0, 10 );
      const time = creation .substring( 11 ) .replaceAll( ':', '-' ) .replaceAll( '.', '-' );
      const shareData = new module .vzomePkg.core.exporters.GitHubShare( title, date, time, xml, image, preview );

      const uploads = [];
      shareData .setEntryHandler( { addEntry: (path, data, encoding) => {
        data && uploads .push( { path, encoding, data } );
      } } );
      const gitUrl = shareData .generateContent( orgName, repoName, branchName, title, description, blog, publish, style );

      commitToGitHub( target, uploads, `Online share - ${name}` )
      .then( () => {
        report( { type: 'SHARE_SUCCESS', payload: gitUrl } );
      })
      .catch((error) => {
        if ( error.message .includes( 'Update is not a fast forward' ) )
          report( { type: 'SHARE_FAILURE', payload: 'You are sharing too frequently; wait a minute and try again.' } );
        else
          report( { type: 'SHARE_FAILURE', payload: error.message } );
      });
    });
}

const fileLoader = ( report, payload ) =>
{
  const { file, debug=false, polygons=true } = payload;
  const { name } = file;
  report( { type: 'FETCH_STARTED', payload: { name, preview: false } } );
  console.log( `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% editing ${name}` );
  const xmlLoading = fetchFileText( file );

  xmlLoading .then( text => report( { type: 'TEXT_FETCHED', payload: { text } } ) ); // Don't send the name yet, parse/interpret may fail

  openDesign( xmlLoading, name, report, debug, polygons );
}

const fileImporter = ( report, payload ) =>
{
  const IMPORT_ACTIONS = {
    'mesh' : 'ImportSimpleMeshJson',
    'cmesh': 'ImportColoredMeshJson',
    'vef'  : 'LoadVEF',
  }
  const { file, format } = payload;
  const action = IMPORT_ACTIONS[ format ];
  fetchFileText( file )

    .then( text => {
      try {
        design.wrapper .doAction( '', action, { vef: text } );
        reportDefaultScene( report );
      } catch (error) {
        console.log( `${action} actionPerformed error: ${error.message}` );
        report( { type: 'ALERT_RAISED', payload: `Failed to perform action: ${action}` } );
      }
    } )
    .catch( error => {
      console.log( error.message );
      console.log( 'Import failed' );
    } )
}

const defaultLoad = { camera: true, lighting: true, design: true, bom: false, };

const urlLoader = async ( report, payload ) =>
{
  const { url, config } = payload;
  const { preview=false, debug=false, polygons=true, showScenes='none', sceneTitle, load=defaultLoad, source=true } = config;
  if ( !url ) {
    throw new Error( "No url field in URL_PROVIDED event payload" );
  }
  const name = url.split( '\\' ).pop().split( '/' ).pop()
  report( { type: 'FETCH_STARTED', payload } );

  console.log( `%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%% ${preview? "previewing" : "interpreting " } ${url}` );
  const xmlLoading = source && fetchUrlText( url );
  source && xmlLoading .then( text => report( { type: 'TEXT_FETCHED', payload: { text, url } } ) ); // Don't send the name yet, parse/interpret may fail

  report = filterScene( report, load );
  if ( preview ) {
    // The client prefers to show a preview if possible.
    const previewUrl = url.substring( 0, url.length-6 ).concat( ".shapes.json" );
    return fetchUrlText( previewUrl )
      .then( text => JSON.parse( text ) )
      .then( preview => {
        design.rendered = ( preview.format === 'online' )? preview : normalizePreview( preview ); // .shapes.json can hold two formats: legacy (the default) or online

        if ( ( showScenes !== 'none' || sceneTitle ) && design.rendered.scenes.length < 2 ) {
          // The client expects scenes, but this preview JSON predates the scenes export,
          //  so fall back on XML.
          console.log( `No scenes in preview ${previewUrl}` );
          console.log( 'Preview failed, falling back to vZome XML' );
          openDesign( xmlLoading, name, report, debug, polygons, sceneTitle );
          return;
        }

        // TODO: don't duplicate this in openDesign()
        const sceneIndex = getSceneIndex( sceneTitle, design.rendered.scenes );
        const events = clientEvents( report );
        if ( design.rendered.scenes.length >= 2 )
          events .scenesDiscovered( design.rendered.scenes .map( ({ title, camera }) => ({ title, camera }) ) ); // strip off snapshot
        events .sceneChanged( prepareSceneResponse( design, sceneIndex ) );
      } )
      .catch( error => {
        console.log( error.message );
        console.log( 'Preview failed, falling back to vZome XML' );
        openDesign( xmlLoading, name, report, debug, polygons, sceneTitle );
      } )
  }
  else {
    openDesign( xmlLoading, name, report, debug, polygons, sceneTitle );
  }
}

const reportDefaultScene = report =>
{
  const { shapes, embedding } = prepareSceneResponse( design, 0 ); // takes a normalized scene
  // never send camera or lighting!
  clientEvents( report ) .sceneChanged( { shapes, embedding, polygons: true } );

  // Now compute an updated parts list
  // const bom = assemblePartsList( shapes );
}

onmessage = ({ data }) =>
{
  // console.log( `TO worker: ${JSON.stringify( data.type, null, 2 )}` );
  const { type, payload, requestId, isInspector } = data;
  if ( typeof payload === 'object' ) {
    payload.polygons = !isInspector;
    if ( typeof payload.config === 'object' ) {
      payload.config.polygons = !isInspector;
    }
  }

  let sendToClient = postMessage;
  if ( !! requestId ) {
    sendToClient = message => {
      message.requestId = requestId;
      postMessage( message );
    }
  }

  try {
    
  switch (type) {

    case 'WORKER_PROBE':
      sendToClient( { type: 'WORKER_READY' } );
      break;

    case 'WINDOW_LOCATION':
      baseURL = payload;
      importLegacy()
        .then( legacy => Promise.all( resourceIndex .map( path => legacy.loadAndInjectResource( path, new URL( `/app/classic/resources/${path}`, baseURL ) ) ) ) );
      break;

    case 'URL_PROVIDED':
      urlLoader( sendToClient, payload );
      break;
  
    case 'FILE_PROVIDED':
      fileLoader( sendToClient, payload );
      break;

    case 'MESH_FILE_PROVIDED':
      fileImporter( sendToClient, payload );
      break;

    case 'SCENE_SELECTED': {
      if ( !design?.rendered?.scenes )
        break;
      const { title, load } = payload;
      const index = getSceneIndex( title, design.rendered.scenes );
      const scene = prepareSceneResponse( design, index ); // takes a normalized scene
      filterScene( sendToClient, load )( { type: 'SCENE_RENDERED', payload: { scene } } );
      break;
    }

    case 'EDIT_SELECTED': {
      const { before, after } = payload; // only one of these will have an edit ID
      const edit = before || after;
      const response = prepareEditSceneResponse( design, edit, !!before );
      sendToClient( { type: 'SCENE_RENDERED', payload: response } );
      break;
    }

    case 'MACRO_TRIGGERED':
    {
      try {
        for (const actionData of payload) {
          const { controllerPath, action, parameters } = actionData;
          design.wrapper .doAction( controllerPath, action, parameters );
        }
        reportDefaultScene( sendToClient );
      } catch (error) {
        console.log( `Macro error: ${error.message}` );
        sendToClient( { type: 'ALERT_RAISED', payload: `Failed to complete macro.` } );
      }
      break;
    }

    case 'ACTION_TRIGGERED':
    {
      const { controllerPath, action, parameters, polygons } = payload;
      try {
        if ( action === 'connectTrackballScene' ) {
          connectTrackballScene( sendToClient, polygons );
          return;
        }
        if ( action === 'shareToGitHub' ) {
          const { target, config, data } = parameters;
          shareToGitHub( target, config, data, sendToClient );
          return;
        }
        if ( action === 'captureScene' ) {
          if ( !design?.rendered?.scenes )
            return;
          const { after, camera } = parameters;
          const { snapshots, scenes, instances } = design.rendered;
          const snapshot = snapshots.length;
          snapshots .push( [ ...instances ] );
          scenes .splice( after+1, 0, { title: '', snapshot, camera } );
          design.wrapper .doAction( controllerPath, 'Snapshot', { id: snapshot } ); // no-op, but the edit must be in the history
          clientEvents( sendToClient ) .scenesDiscovered( scenes .map( ({ title, camera }) => ({ title, camera }) ) ); // strip off snapshot
          return;
        }
        if ( action === 'moveScene' ) {
          if ( !design?.rendered?.scenes )
            return;
          const { index, change } = parameters;
          const target = index + change;
          const { scenes } = design.rendered;
          scenes[ target ] = scenes .splice( index, 1, scenes[ target ] )[ 0 ];
          clientEvents( sendToClient ) .scenesDiscovered( design.rendered.scenes .map( ({ title, camera }) => ({ title, camera }) ) ); // strip off snapshot
          return;
        }
        if ( action === 'duplicateScene' ) {
          if ( !design?.rendered?.scenes )
            return;
          const { after, camera } = parameters;
          const { snapshot } = design.rendered.scenes[ after ];
          design.rendered.scenes .splice( after+1, 0, { title: '', snapshot, camera } );
          clientEvents( sendToClient ) .scenesDiscovered( design.rendered.scenes .map( ({ title, camera }) => ({ title, camera }) ) ); // strip off snapshot
          return;
        }
        if ( action === 'snapCamera' ) {
          const symmController = design.wrapper .getControllerByPath( controllerPath );
          const { up, lookDir } = parameters;
          const result = design.wrapper .snapCamera( symmController.controller, up, lookDir );
          sendToClient( { type: 'CAMERA_SNAPPED', payload: { up: result.up, lookDir: result.lookDir } } );
          return;
        }
        if ( action === 'exportText' && parameters.format === 'shapes' ) {
          const { camera, lighting } = parameters;
          const preview = exportPreview( camera, lighting );
          clientEvents( sendToClient ) .textExported( action, preview );
          return;
        }
        if ( action === 'exportText' && parameters.format === 'vZome' ) {
          const { camera, lighting } = parameters;
          const xml = design.wrapper .serializeVZomeXml( lighting, camera );
          clientEvents( sendToClient ) .textExported( action, xml );
          return;
        }
        // console.log( "action", uniqueId );
        design.wrapper .doAction( controllerPath, action, parameters );
        reportDefaultScene( sendToClient );
      } catch (error) {
        console.log( `${action} actionPerformed error: ${error.message}` );
        sendToClient( { type: 'ALERT_RAISED', payload: `Failed to perform action: ${action}` } );
      }
      break;
    }

    case 'PROPERTY_SET':
    {
      const { controllerPath, name, value } = payload;
      try {
        design.wrapper .setProperty( controllerPath, name, value );
      } catch (error) {
        console.log( `${action} setProperty error: ${error.message}` );
        sendToClient( { type: 'ALERT_RAISED', payload: `Failed to set property: ${name}` } );
      }
      break;
    }

    case 'PROPERTY_REQUESTED':
    {
      const { controllerPath, propName, changeName, isList } = payload;
      design.wrapper .registerPropertyInterest( controllerPath, propName, changeName, isList );
      break;
    }

    case 'NEW_DESIGN_STARTED':
      const { field } = payload;
      createDesign( sendToClient, field );
      break;

    case 'STRUT_CREATION_TRIGGERED':
    case 'JOIN_BALLS_TRIGGERED':
    {
      design.wrapper .doAction( 'buildPlane', type, payload );
      reportDefaultScene( sendToClient );
      break;
    }

    case 'SIMPLE_STRUT_CREATE':
    {
      // payload: { anchorId, orbit, lengthScale, half, index }
      const { anchorId, orbit, lengthScale=1, half=false, index=0 } = payload;
      try {
        // Minimal heuristic creation bypassing buildPlane controller.
        const rm = design.renderedModel.getRenderedManifestation( anchorId );
        if ( !rm ) throw new Error('anchor not found');
        const anchor = rm.getManifestation().toConstruction();
        // Acquire axis from orbit + index
        const orbitSource = design.wrapper.controller.getSubController( 'symmetry' ).getOrbitSource();
        const dir = orbitSource.getDirection( orbit );
        const axis = dir.getAxis( 0, index ); // 0 meaning PLUS sense
        // lengthScale maps to existing predefined: supershort=0, short=1, medium=2, long=3 (approx)
        const lengthController = design.wrapper.controller.getSubController( `buildPlane/length.${orbit}` )
            || design.wrapper.controller.getSubController( `buildPlane/length.${dir.getName()}` );
        if ( lengthController ) {
          design.wrapper.setProperty( `buildPlane/length.${orbit}`, 'scale', ''+lengthScale );
          const halfProp = design.wrapper.getProperty( `buildPlane/length.${orbit}`, 'half' );
          if ( (halfProp === 'true') !== half ) {
            design.wrapper.doAction( `buildPlane/length.${orbit}`, 'toggleHalf' );
          }
        }
        // Perform StrutCreation edit directly
  // Fallback length: use direction canonical unit scaled; if API absent, let legacy decide default via lengthScale mapping
  design.wrapper.doEdit( 'StrutCreation', { anchor, zone: axis, length: axis.getLength ? axis.getLength( lengthScale ) : axis } );
        reportDefaultScene( sendToClient );
      } catch (error) {
        console.log( 'SIMPLE_STRUT_CREATE failed', error );
        sendToClient( { type: 'ALERT_RAISED', payload: 'Failed to create strut.' } );
      }
      break;
    }

    case 'HINGE_STRUT_SELECTED':
    {
      design.wrapper .doAction( 'buildPlane', type, payload );
      break;
    }

    case 'PREVIEW_STRUT_START':
    {
      const { ballId, direction } = payload;
      design.wrapper .startPreviewStrut( ballId, direction );
      break;
    }

    case 'PREVIEW_STRUT_MOVE':
    {
      const { direction } = payload;
      design.wrapper .movePreviewStrut( direction );
      break;
    }

    case 'PREVIEW_STRUT_SCALE':
    {
      const { increment } = payload;
      design.wrapper .scalePreviewStrut( increment );
      break;
    }
  
    case 'PREVIEW_STRUT_END':
    {
      design.wrapper .endPreviewStrut();
      reportDefaultScene( sendToClient );
      break;
    }

    case 'HISTORY_REQUESTED':
    {
      try {
        // Serialize full design (includes <EditHistory/>), then extract just that element to reduce payload.
        // NOTE: This is a simple substring extraction; if structure changes, consider DOM parsing.
        if ( !design?.wrapper ) {
          sendToClient( { type: 'EDIT_HISTORY_SERIALIZED', payload: { xml: '<EditHistory/>' } } );
          break;
        }
    const { camera, lighting } = safeRenderConfig( design.rendered );
    const xml = design.wrapper .serializeVZomeXml( lighting, camera );
        let historyXml = '<EditHistory/>';
        const start = xml.indexOf( '<EditHistory' );
        if ( start >= 0 ) {
          const closeTag = '</EditHistory>';
          const end = xml.indexOf( closeTag, start );
          if ( end >= 0 ) historyXml = xml.substring( start, end + closeTag.length );
          else {
            // attempt self-closing variant detection
            const selfClose = xml.indexOf( '/>', start );
            if ( selfClose > start ) historyXml = xml.substring( start, selfClose + 2 );
          }
        }
        sendToClient( { type: 'EDIT_HISTORY_SERIALIZED', payload: { xml: historyXml } } );
      } catch (error) {
        console.log( `HISTORY_REQUESTED error: ${error.message}` );
        sendToClient( { type: 'EDIT_HISTORY_SERIALIZED', payload: { xml: `<EditHistory error="${error.message}"/>` } } );
      }
      break;
    }

    case 'HISTORY_REPLACE':
    {
      const { historyXml } = payload || {};
      try {
        if ( !design?.wrapper ) throw new Error( 'No design loaded' );
        if ( typeof historyXml !== 'string' || !historyXml.startsWith('<EditHistory') ) throw new Error( 'historyXml must start with <EditHistory' );

        // Serialize current doc
    const { camera, lighting } = safeRenderConfig( design.rendered );
    const currentXml = design.wrapper .serializeVZomeXml( lighting, camera );
        const historyRegex = /<EditHistory[\s\S]*?<\/EditHistory>/;
        if ( !historyRegex.test( currentXml ) ) throw new Error( 'Existing EditHistory not found in document' );
        const newXml = currentXml.replace( historyRegex, historyXml );

        // Reload design from modified XML
        const events = clientEvents( sendToClient );
        importLegacy()
          .then( legacy => {
            let tempDesign;
            try {
              tempDesign = legacy .loadDesign( newXml, false, true, events );
              // Sanity: attempt serialization so we catch latent issues early
      const { camera, lighting } = safeRenderConfig( tempDesign.rendered );
      tempDesign.wrapper .serializeVZomeXml( lighting, camera );
            } catch (loadErr) {
              throw loadErr; // will be caught below
            }
            // Success; replace global design
            design = tempDesign;
            prepareDefaultScene( design );
            events.sceneChanged( prepareSceneResponse( design, 0 ) );
            sendToClient( { type: 'HISTORY_REPLACED', payload: { success: true } } );
          })
          .catch( error => {
            console.log( `HISTORY_REPLACE load error: ${error.message}` );
            sendToClient( { type: 'HISTORY_REPLACED', payload: { success: false, message: error.message } } );
          });
      } catch ( error ) {
        console.log( `HISTORY_REPLACE error: ${error.message}` );
        sendToClient( { type: 'HISTORY_REPLACED', payload: { success: false, message: error.message } } );
      }
      break;
    }
  
    default:
      console.log( 'action not handled:', type, payload );
  }
  } catch (error) {
    console.log( `${type} onmessage error: ${error.message}` );
    sendToClient( { type: 'ALERT_RAISED', payload: `Failed to perform action: ${type}` } );
  }
}