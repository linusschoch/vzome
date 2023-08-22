
import { Divider, Menu, MenuAction, MenuItem, SubMenu } from "../../framework/menus.jsx";

import { createEffect, createSignal } from "solid-js";
import { controllerAction, controllerExportAction, controllerProperty } from "../../../workerClient/controllers-solid.js";
import { serializeVZomeXml, download } from '../../../workerClient/serializer.js';
import { UrlDialog } from '../components/webloader.jsx'
import { fetchDesign, openDesignFile, newDesign } from "../../../workerClient/index.js";
import { useWorkerClient } from "../../../workerClient/index.js";
import { Guardrail } from "../components/guardrail.jsx";

const NewDesignItem = props =>
{
  const { rootController } = useWorkerClient();
  const fieldLabel = () => controllerProperty( rootController(), `field.label.${props.field}` );
  // TODO: enable ⌘N
  const modifiers = () => props.field === 'golden' && '⌘';
  const key = () => props.field === 'golden' && 'N';
  return !!fieldLabel() &&
    <MenuAction label={`${fieldLabel()} Field`} onClick={props.onClick} />
}

export const FileMenu = () =>
{
  const { postMessage, rootController, state } = useWorkerClient();
  const [ showDialog, setShowDialog ] = createSignal( false );
  const fields = () => controllerProperty( rootController(), 'fields', 'fields', true );
  const [ showGuardrail, setShowGuardrail ] = createSignal( false );
  const edited = () => controllerProperty( rootController(), 'edited' ) === 'true';

  // Since the initial render of the menu doesn't fetch these properties,
  //   we have to force this prefetch so the data is ready when we need it.
  createEffect( () =>
  {
    const getLabel = (field) => controllerProperty( rootController(), `field.label.${field}` );
    const isEdited = edited();
    for (const field of fields()) {
      const label = getLabel(field);
      if ( label === 'no logging' ) // trick the compiler
        console.log( `never logged: ${isEdited} ${label}`);
    }
  });

  const doCreate = field =>
  {
    postMessage( newDesign( field ) );
  }

  let inputRef;
  const openFile = evt =>
  {
    inputRef.click();
  }
  const onFileSelected = e => {
    const selected = e.target.files && e.target.files[0]
    if ( selected ) {
      postMessage( openDesignFile( selected, false ) );
    }
    inputRef.value = null;
  }

  const handleShowUrlDialog = () => {
    setShowDialog( true );
  }
  const openUrl = url => {
    if ( url && url.endsWith( ".vZome" ) ) {
      postMessage( fetchDesign( url, { preview: false, debug: false } ) );
    }
  }

  let continuation;
  const guard = guardedAction =>
  {
    if ( edited() ) {
      continuation = guardedAction;
      setShowGuardrail( true );
    }
    else
      guardedAction();
  }
  const closeGuardrail = continued =>
  {
    setShowGuardrail( false );
    if ( continued )
      continuation();
    continuation = undefined;
  }

  const exportAs = ( format, mimeType ) => evt =>
  {
    controllerExportAction( rootController(), format )
      .then( text => {
        const vName = rootController().source?.name || 'untitled.vZome';
        const name = vName.substring( 0, vName.length-6 ).concat( "." + format );
        download( name, text, mimeType );
      });
  }

  const save = evt =>
  {
    controllerExportAction( rootController(), 'vZome' )
      .then( text => {
        const { camera, liveCamera, lighting } = state.scene;
        const fullText = serializeVZomeXml( text, lighting, liveCamera, camera );
        const name = rootController().source?.name || 'untitled.vZome';
        download( name, fullText, 'application/xml' );
        controllerAction( rootController(), 'clearChanges' );
      });
  }

  return (
    <Menu label="File" dialogs={<>
      <input style={{ display: 'none' }} type="file" ref={inputRef}
        onChange={onFileSelected} accept={".vZome"} />

      <UrlDialog show={showDialog()} setShow={setShowDialog} openDesign={openUrl} />

      <Guardrail show={showGuardrail()} close={closeGuardrail} />
    </>}>
        <SubMenu label="New Design...">
          <For each={fields()}>{ field =>
            <NewDesignItem field={field} onClick={() => guard( () => doCreate(field) )}/>
          }</For>
        </SubMenu>

        <MenuAction label="Open..." onClick={() => guard(openFile)} />
        <MenuAction label="Open URL..." onClick={() => guard(handleShowUrlDialog)} />
        <MenuItem disabled={true}>Open As New Model...</MenuItem>

        <Divider/>

        <MenuAction label="Save" onClick={save} mods="⌘" key="S" />

        <Divider/>

        <MenuItem onClick={ exportAs( 'stl', 'application/sla' ) }>Export STL</MenuItem>
    </Menu>
  );
}
