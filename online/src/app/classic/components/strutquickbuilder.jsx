import { createSignal, Show, For, createEffect } from 'solid-js';
import Button from '@suid/material/Button';
import ToggleButton from '@suid/material/ToggleButton';
import ToggleButtonGroup from '@suid/material/ToggleButtonGroup';
import FormControlLabel from '@suid/material/FormControlLabel';
import Switch from '@suid/material/Switch';

import { useWorkerClient } from '../../../viewer/context/worker.jsx';
import { useViewer } from '../../../viewer/context/viewer.jsx';
import { doControllerAction } from '../../../viewer/util/actions.js';
import { controllerProperty } from '../../framework/context/editor.jsx';

// Minimal v1 quick strut builder: choose size (B0..B3 + half), choose index, create strut at single selected ball.
// Future: ghost preview, color family switching, keyboard shortcuts.

export const StrutQuickBuilderPanel = ( props ) => {
  const { postMessage, subscribeFor } = useWorkerClient();
  const { scene } = useViewer();
  const controller = () => props.controller;

  const [ anchorBall, setAnchorBall ] = createSignal( null ); // { shapeId, id, position }
  const [ size, setSize ] = createSignal( 'B1' ); // default mid
  const [ half, setHalf ] = createSignal( false );
  const [ index, setIndex ] = createSignal( 0 );
  const [ availableIndices, setAvailableIndices ] = createSignal( Array.from({length:12}, (_,i)=>i) ); // fallback generic 12 directions
  const [ orbitLetter, setOrbitLetter ] = createSignal( 'B' );

  // Track selection to find a single ball anchor
  const computeAnchor = () => {
    const shapes = scene.shapes || {};
    let found = null; let count = 0;
    for ( const shape of Object.values( shapes ) ) {
      const isBallShape = shape.id === 'connector' || /ball/i.test( shape.id ) || shape.category === 'BALL';
      if ( !isBallShape ) continue;
      for ( const inst of (shape.instances||[]) ) {
        if ( inst.selected ) { count++; found = { shapeId: shape.id, id: inst.id, position: inst.location }; if ( count > 1 ) break; }
      }
      if ( count > 1 ) break;
    }
    setAnchorBall( count === 1 ? found : null );
  };

  createEffect( computeAnchor );
  subscribeFor( 'SELECTION_TOGGLED', computeAnchor );

  // crude mapping sizes to internal length scale increments; placeholder until pulled from controller
  const lengthFor = () => {
    // Using simplistic mapping: B0=super short, B1=short, B2=medium, B3=long; half toggles a flag we append " (half)"
    // Ultimately we want exact algebraic pair string; for now rely on orbit length controller implicit default.
    switch( size() ) {
      case 'B0': return { scale: 0 };
      case 'B1': return { scale: 1 };
      case 'B2': return { scale: 2 };
      case 'B3': return { scale: 3 };
      default: return { scale: 1 };
    }
  };

  const canCreate = () => !!anchorBall();

  // Update orbit letter when build direction selection changes
  const updateOrbit = () => {
    const orbit = controllerProperty( controller(), 'selectedOrbit', 'orbits', false );
    if ( orbit ) {
      // orbit names come like 'blue', 'green', etc.; take first letter uppercased
      setOrbitLetter( orbit[0].toUpperCase() );
      // Adjust size labels if current prefix differs
      setSize( s => orbitLetter() + s.substring(1) );
    }
  };
  createEffect( updateOrbit );
  // Listen for property changes
  subscribeFor( 'CONTROLLER_PROPERTY_CHANGED', ({ controllerPath, name }) => {
    if ( name === 'selectedOrbit' ) updateOrbit();
  });

  const handleCreate = () => {
    if ( !canCreate() ) return;
    const orbit = controllerProperty( controller(), 'selectedOrbit', 'orbits', false );
    const lengthScale = parseInt( size().substring(1) ) || 1; // from e.g. G2
    postMessage( { type: 'SIMPLE_STRUT_CREATE', payload: { anchorId: anchorBall().id, orbit, lengthScale, half: half(), index: index() } } );
  };

  return (
    <div style={{ padding:'6px', 'background-color':'whitesmoke', 'border-radius':'6px', display:'flex', 'flex-direction':'column', gap:'8px' }}>
      <div style={{ 'font-weight':'bold' }}>Quick Strut</div>
      <Show when={anchorBall()} fallback={<div style={{ 'font-size':'0.85em', 'font-style':'italic' }}>Select exactly one ball to start.</div>}>
        <div style={{ 'font-size':'0.75em' }}>Anchor: {anchorBall()?.id}</div>
      </Show>
      <div>
        <ToggleButtonGroup value={size()} exclusive onChange={(e,v)=> v && setSize(v)} size='small'>
          <ToggleButton value={`${orbitLetter()}0`}>{orbitLetter()}0</ToggleButton>
          <ToggleButton value={`${orbitLetter()}1`}>{orbitLetter()}1</ToggleButton>
          <ToggleButton value={`${orbitLetter()}2`}>{orbitLetter()}2</ToggleButton>
          <ToggleButton value={`${orbitLetter()}3`}>{orbitLetter()}3</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel sx={{ 'margin-left':'8px' }} control={<Switch size='small' checked={half()} onChange={e=>setHalf(e.target.checked)} />} label='half' />
      </div>
      <div style={{ display:'flex', 'flex-wrap':'wrap', gap:'4px' }}>
        <For each={availableIndices()}>{ i =>
          <Button variant={ i===index()? 'contained':'outlined' } size='small' onClick={()=>setIndex(i)}>{i}</Button>
        }</For>
      </div>
      <Button disabled={!canCreate()} variant='contained' size='small' onClick={handleCreate}>Create Strut</Button>
  <div style={{ 'font-size':'0.65em', color:'#555' }}>v1 prototype. Index set 0..11. Size mapping provisional. Orbit: {orbitLetter()}</div>
    </div>
  );
};

export default StrutQuickBuilderPanel;
