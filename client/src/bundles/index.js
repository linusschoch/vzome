
import { createStore, applyMiddleware, combineReducers } from 'redux'

import * as alerts from './alerts'
import * as camera from './camera'
import * as lighting from './lighting'
import * as progress from './progress'
import * as commands from '../commands'
import * as workingPlane from './planes'
import * as designs from './designs'
import * as shapers from './shapers'

const requiredBundles = { lighting, camera }

let bundles
const urlParams = new URLSearchParams( window.location.search );
const profile = urlParams.get( "profile" ) || urlParams.get( "editMode" )
switch ( profile ) {

  case "plane":
    bundles = { ...requiredBundles, designs, shapers, workingPlane }
    break;

  default:
    bundles = { ...requiredBundles, designs, shapers, commands, alerts, progress }
    break;
}

  // if ( ! store.getState().workingPlane ) {
  //   let url = "/app/models/vZomeLogo.vZome"
  //   const urlParams = new URLSearchParams( window.location.search );
  //   if ( urlParams.has( "url" ) ) {
  //     url = decodeURI( urlParams.get( "url" ) )
  //   }
  //   store.dispatch( fetchModel( url, 'logo' ) )
  // }

export default ( middleware ) =>
{
  const names = Object.keys( bundles )

  const reducers = names.reduce( ( obj, key ) => {
    const reducer = bundles[key].reducer
    if ( reducer )
      obj[ key ] = reducer
    return obj
  }, {} )

  if ( urlParams.get( 'debug' ) === 'true' ) {
    reducers.dbuggerEnabled = () => true
  }

  console.log( `bundle reducers: ${JSON.stringify( Object.keys( reducers ) )}` )

  const rootReducer = combineReducers( reducers )
  
  const store = createStore( rootReducer, undefined, applyMiddleware( ...middleware ) );
  
  // TODO: is there a better pattern than these inits?
  names.map( key => {
    const init = bundles[key].init
    if ( init ) {
      console.log( `bundle init: ${key}` )
      init( window, store )
    }
    return null
  } )

  return store
}