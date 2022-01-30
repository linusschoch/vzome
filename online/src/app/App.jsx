
import React from 'react'

import { DesignHistoryInspector } from './components/inspector.jsx'
import { ErrorAlert } from './components/alert.jsx'
import { VZomeAppBar } from './components/appbar.jsx'
import { DesignViewer, WorkerContext, useVZomeUrl } from '../ui/viewer/index.jsx'

const queryParams = new URLSearchParams( window.location.search );
const url = queryParams.get( 'url' ); // support for legacy inspector usage
const oneDesign = !!url;

const App = () =>
{
  useVZomeUrl( url, { preview: oneDesign } );

  return (
    <>
      <VZomeAppBar oneDesign={oneDesign} />
      { oneDesign? <DesignViewer/> : <DesignHistoryInspector/> }
      <ErrorAlert/> 
    </>
  );
}

export const Online = () => (
  <WorkerContext>
    <App/>
  </WorkerContext>
)