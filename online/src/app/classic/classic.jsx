
import { createSignal } from 'solid-js';

import { subController, useEditor } from '../framework/context/editor.jsx';
import { Tab, Tabs } from '../framework/tabs.jsx';

import { CameraControls } from './components/camera.jsx';
import { StrutBuildPanel } from './components/strutbuilder.jsx';
import { BookmarkBar, ToolBar, ToolFactoryBar } from './components/toolbars.jsx';
import { SceneEditor } from './components/editor.jsx';
import { ErrorAlert } from "./components/alert.jsx";
import { SceneControls } from './components/scenecontrols.jsx';
import { MeasurePanel } from './components/measure.jsx';
import { EditHistoryPanel } from './components/edithistorypanel.jsx';

export const ClassicEditor = () =>
{
  const { rootController, indexResources } = useEditor();
  indexResources();

  const bookmarkController = () => subController( rootController(), 'bookmark' );
  const strutBuilder       = () => subController( rootController(), 'strutBuilder' );
  const toolsController    = () => subController( strutBuilder(), 'tools' );

  const [ tab, setTab ] = createSignal( "Build" );
  const changeTab = (event, newValue) => setTab( newValue );

  let alertRoot;
  return (
    <div id='classic' ref={alertRoot} style={{ display: 'grid', 'grid-template-rows': '1fr' }} class='whitesmoke-bkgd'>
      <div id='editor-main' class='grid-cols-1-min whitesmoke-bkgd' >

        <div id='editor-canvas' style={{ display: 'grid', 'grid-template-rows': 'min-content min-content 1fr min-content' }}>
          <ToolFactoryBar/>
          <ToolBar toolsController={toolsController()} editorController={rootController()} />
          <div id='canvas-and-bookmarks' style={{ display: 'grid', 'grid-template-columns': 'min-content 1fr' }}>
            <div>
              <BookmarkBar bookmarkController={bookmarkController()} toolsController={toolsController()} />
              <EditHistoryPanel />
            </div>
            <SceneEditor/>
          </div>
          <div id='article-and-status' style={{ display: 'grid', 'grid-template-columns': 'min-content 1fr' }}>
            <SceneControls/>
            <div id='stats-bar' class='placeholder' style={{ 'min-height': '30px' }} >Status</div>
          </div>
        </div>

        <div id='editor-drawer' class='grid-rows-min-1 editor-drawer'>
          <CameraControls/>
          <Tabs values={ [ 'Build', 'Parts', 'Measure'] } value={tab()} onChange={changeTab}>
            <Tab value='Build'>
              <div id="build-parts-measure" style={{ height: '100%' }}>
                <StrutBuildPanel/>
              </div>
            </Tab>
            <Tab value='Parts'>

            </Tab>
            <Tab value='Measure'>
              <MeasurePanel/>
            </Tab>
          </Tabs>
        </div>

      </div>
      <ErrorAlert/>
    </div>
  )
}
