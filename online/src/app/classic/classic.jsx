
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { doControllerAction, newDesign, requestControllerList } from '../../ui/viewer/store.js';

import Grid from '@material-ui/core/Grid'
import Button from '@material-ui/core/Button';
import { useEffect } from 'react';

const controllerSelector = ( path, name ) => state =>
{
  const elements = path.split( '/' );
  if ( name )
    elements .push( name );
  let result = state.controller;
  for ( const element of elements ) {
    if ( !result )
      return result;
    if ( !element )
      continue;
    result = result[ element ];
  }
  return result;
}

export const useController = ( path ) =>
{
  const report = useDispatch();
  useEffect( () => report( newDesign() ), [] );

  const controller = useSelector( controllerSelector( path ) );
  const selector = name => controllerSelector( path, name );
  if ( controller ) {
    const doAction = action => report( doControllerAction( path, action ) );
    const getList = name => report( requestControllerList( path, name ) );
    return { ready: true, doAction, getList, selector };
  }
  else
    return { selector };
}

export const useControllerList = ( controller, listName ) =>
{
  useEffect( () => {
    if ( controller.ready )
      controller.getList( listName );
  }, [ controller ] );
  return useSelector( controller.selector( listName ) );
}

const controllerAction = ( controller, action ) => evt =>
{
  if ( controller.ready )
    controller .doAction( action );
}

export const ClassicEditor = ( props ) =>
{
  const controller = useController( '' );
  const orbitNames = useControllerList( controller, 'orbits' );

  const drawerColumns = 5;
  const canvasColumns = 12 - drawerColumns;

  return (
    <div style={{ flex: '1', height: '100%' }}>
      <Grid id='editor-main' container spacing={0} style={{ height: '100%' }}>        
        <Grid id='editor-drawer' item xs={drawerColumns}>
          <Button variant="contained" color="primary" onClick={controllerAction( controller, 'rZomeOrbits' )}>
            Real Zome Orbits
          </Button>
        </Grid>
        <Grid id='editor-canvas' item xs={canvasColumns} >
          <div id='swing-root'></div>
          <ul>
            { orbitNames && orbitNames.map && orbitNames.map( orbit => <li key={orbit}>{orbit}</li> ) }
          </ul>
        </Grid>
      </Grid>
    </div>
  )
}
