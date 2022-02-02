
import React from 'react'

import { DesignHistoryInspector } from './components/inspector.jsx'
import { ErrorAlert } from './components/alert.jsx'
import { VZomeAppBar } from './components/appbar.jsx'
import { getModelURL } from './components/folder.jsx';
import { DesignViewer, WorkerContext, useVZomeUrl } from '../ui/viewer/index.jsx'

const queryParams = new URLSearchParams( window.location.search );
const url = queryParams.get( 'url' ); // support for legacy viewer usage (old vZome shares)
const legacyViewerMode = !!url;

const App = () =>
{
  useVZomeUrl( url || getModelURL( 'vZomeLogo' ), { preview: legacyViewerMode } );

  return (
    <>
      <VZomeAppBar oneDesign={legacyViewerMode} />
      { legacyViewerMode? <DesignViewer useSpinner/> : <DesignHistoryInspector/> }
      <ErrorAlert/> 
    </>
  );
}

export const Online = () => (
  <WorkerContext>
    <App/>
  </WorkerContext>
)