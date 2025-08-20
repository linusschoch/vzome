
import { createSignal, createEffect, onCleanup, For } from 'solid-js';
import { useEditor } from '../../framework/context/editor.jsx';
import { useWorkerClient } from '../../../viewer/context/worker.jsx';
import ExpandMoreIcon from '@suid/icons-material/ExpandMore';
import ExpandLessIcon from '@suid/icons-material/ExpandLess';

// Request history from worker; returns promise resolving to XML fragment string
async function requestHistory( workerClient ) {
  if ( !workerClient ) return '<EditHistory/>';
  // Use postRequest to correlate a response; worker responds with EDIT_HISTORY_SERIALIZED
  const { postRequest } = workerClient;
  const response = await postRequest( { type: 'HISTORY_REQUESTED' } );
  // postRequest gives back the full message (with type & payload)
  return response.payload?.xml || '<EditHistory/>';
}


export function EditHistoryPanel() {
  const [open, setOpen] = createSignal(false);
  const [xml, setXml] = createSignal('');
  const [dirty, setDirty] = createSignal(false);
  const [status, setStatus] = createSignal('');
  const [edits, setEdits] = createSignal([]); // parsed edit elements
  const [listMode, setListMode] = createSignal(true); // structured view vs raw XML
  // Initial list view height; user can resize via CSS resize handle
  const initialListHeight = 380;
  const { state } = useEditor();
  const workerClient = useWorkerClient();

  // Subscribe directly for EDIT_HISTORY_SERIALIZED pushes (could be extended in future)
  // Currently unused since we pull on demand, but left for evolution.
  let unsubscribeHistory;
  createEffect( () => {
    if ( open() ) {
      // set up subscription only once per open
      if ( !unsubscribeHistory ) {
        unsubscribeHistory = workerClient.subscribeFor( 'EDIT_HISTORY_SERIALIZED', ( { xml: fragment } ) => {
          setXml( fragment );
          setDirty(false);
          setStatus('');
          tryParse(fragment);
        } );
      }
    } else if ( unsubscribeHistory ) {
      unsubscribeHistory();
      unsubscribeHistory = undefined;
    }
  });
  onCleanup( () => unsubscribeHistory && unsubscribeHistory() );

  // Listen for replace status
  createEffect( () => {
    if ( workerClient ) {
      workerClient.subscribeFor( 'HISTORY_REPLACED', ( { success, message } ) => {
        if ( success ) {
          setStatus('Applied');
          // Fetch fresh serialized version to normalize formatting
          requestHistory( workerClient ).then( setXml );
          setDirty(false);
        } else {
          setStatus('Error: ' + message);
        }
      });
    }
  });

  // --- Parsing & building helpers ---
  const tryParse = ( fragment ) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString( fragment, 'application/xml' );
      const root = doc.documentElement;
      if ( root.nodeName !== 'EditHistory' ) return;
      const list = [];
      for ( const child of Array.from( root.children ) ) {
        const attrs = {};
        for ( const attr of Array.from( child.attributes ) ) attrs[ attr.name ] = attr.value;
        list.push( { type: child.localName, attrs } );
      }
      setEdits( list );
    } catch (e) {
      // ignore parse errors; stay in raw mode
    }
  };

  const buildXmlFromEdits = () => {
    const headerMatch = xml().match( /<EditHistory[^>]*>/ );
    let header = '<EditHistory editNumber="'+edits().length+'" lastStickyEdit="-1">';
    if ( headerMatch ) {
      // preserve any attributes other than editNumber/lastStickyEdit if present
      const raw = headerMatch[0];
      const preserved = raw.replace(/editNumber="[^"]*"/,'').replace(/lastStickyEdit="[^"]*"/,'').replace(/>$/,'').trim();
      header = preserved.startsWith('<EditHistory') ? preserved + ' editNumber="'+edits().length+'" lastStickyEdit="-1">' : header;
    }
    const body = edits().map( e => {
      const attrs = Object.entries( e.attrs ).map( ([k,v]) => `${k}="${v}"` ).join(' ');
      return `  <${e.type}${attrs? ' '+attrs:''}/>`;
    }).join('\n');
    return `${header}\n${body}\n</EditHistory>`;
  };

  const modifyEditAttr = ( index, name, value ) => {
    setEdits( list => list.map( (e,i) => i===index? { ...e, attrs: { ...e.attrs, [name]: value } } : e ) );
    setDirty(true); setStatus('');
  };

  const removeEdit = ( index ) => {
    setEdits( list => list.filter( (_,i) => i!==index ) );
    setDirty(true); setStatus('');
  };

  const addStrut = () => {
    setEdits( list => [ ...list, { type: 'StrutCreation', attrs: { anchor:'0 0 0 0 0 0', index:'0', len:'2 4' } } ] );
    setDirty(true); setStatus('');
  };

  const KNOWN_TYPES = [ 'StrutCreation', 'SelectManifestation', 'DeselectAll', 'ApplyTool', 'BeginBlock', 'EndBlock', 'ConvexHull3d' ];

  const addGeneric = ( type ) => {
    if ( !type ) return;
    let attrs = {};
    switch( type ) {
      case 'SelectManifestation': attrs = { point:'0 0 0 0 0 0' }; break;
      case 'ApplyTool': attrs = { name: 'tetrahedral.builtin/tetrahedral around origin', selectInputs:'true', copyColors:'true' }; break;
      case 'ConvexHull3d': attrs = { mode:'' }; break;
      case 'DeselectAll':
      case 'BeginBlock':
      case 'EndBlock':
        attrs = {}; break;
      default:
        attrs = {}; break;
    }
    setEdits( list => [ ...list, { type, attrs } ] );
    setDirty(true); setStatus('');
  };

  // initial parse when xml first arrives
  createEffect( () => { if ( xml() && !dirty() ) tryParse( xml() ); });

  // Fetch XML whenever the edit state changes and the panel is open
  // Subscribe for scene renders to keep history fresh.
  let unsubscribeScene;
  createEffect( () => {
    if ( workerClient && !unsubscribeScene ) {
      unsubscribeScene = workerClient.subscribeFor( 'SCENE_RENDERED', () => {
        if ( open() ) requestHistory( workerClient ).then( setXml );
      } );
    }
  });
  onCleanup( () => unsubscribeScene && unsubscribeScene() );

  // Also fetch XML when opening the panel
  const togglePanel = async () => {
  if (!open()) setXml( await requestHistory( workerClient ) );
    setOpen(o => !o);
  };

  return (
    <div class="edithistory-panel" style={{border: '1px solid #ccc', margin: '8px 0', borderRadius: '4px', background: '#fafbfc', width: '340px', minWidth: '320px', maxWidth: '100%'}}>
      <button class="edithistory-toggle" style={{display: 'flex', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: '8px', cursor: 'pointer', fontWeight: 'bold'}} onClick={togglePanel}>
        {open() ? <ExpandLessIcon/> : <ExpandMoreIcon/>}
        <span style={{marginLeft: '8px'}}>Edit History (XML)</span>
      </button>
      <div style={{display: open() ? 'block' : 'none', padding: '8px'}}>
        <div style={{ 'margin-bottom':'6px', display: 'flex', gap: '8px', 'flex-wrap':'wrap' }}>
          <button onClick={() => setListMode(m => !m)}>{listMode()? 'Raw XML' : 'List View'}</button>
          { listMode() && <button onClick={addStrut}>Add Strut</button> }
          { listMode() && (
            <select onChange={ e => { addGeneric( e.currentTarget.value ); e.currentTarget.selectedIndex = 0; } }>
              <option value=''>Add Edit…</option>
              <For each={KNOWN_TYPES}>{t => <option value={t}>{t}</option>}</For>
            </select>
          ) }
        </div>
        { listMode() ? (
          <div>
            <div style={{ height: initialListHeight + 'px', overflow: 'auto', border: '1px solid #ddd', 'border-radius':'4px', padding: '4px', 'background':'#fafafa', resize: 'vertical' }}>
            <For each={edits()}>{(edit, i) =>
              <div style={{ display:'grid', 'grid-template-columns':'repeat( auto-fit, minmax(60px,1fr) )', gap:'4px', 'align-items':'center', 'margin-bottom':'4px', 'font-size':'0.75rem', border:'1px solid #eee', padding:'4px', 'border-radius':'3px' }}>
                <strong style={{ 'grid-column':'1 / span 2' }}>{i()+1}. {edit.type}</strong>
                <For each={Object.keys( edit.attrs )}>{ attr =>
                  <label style={{display:'flex', 'flex-direction':'column'}}>
                    {attr}
                    <input value={edit.attrs[ attr ]} onInput={e=>modifyEditAttr(i(), attr, e.currentTarget.value)} />
                  </label>
                }</For>
                { Object.keys( edit.attrs ).length === 0 && <div style={{ 'grid-column':'1 / span 2', 'font-style':'italic' }}>no attributes</div> }
                <button style={{ 'grid-column':'1 / span 2' }} onClick={()=>removeEdit(i())}>Remove</button>
              </div>
            }</For>
            </div>
          </div>
        ) : (
          <textarea
            style={{width: '100%', minWidth: '300px', minHeight: '240px', fontFamily: 'monospace', fontSize: '0.97em', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', resize: 'vertical'}}
            value={xml()}
            onInput={e => { setXml(e.currentTarget.value); setDirty(true); setStatus(''); tryParse(e.currentTarget.value); }}
          />
        ) }
        <div style={{display: 'flex', 'justify-content': 'space-between', 'margin-top': '6px'}}>
          <button disabled={!dirty()} onClick={() => {
            const text = listMode()? buildXmlFromEdits() : xml();
            if ( !/^<EditHistory[\s\S]*<\/EditHistory>$/m.test( text ) ) { setStatus('Error: invalid root'); return; }
            const beginCount = (text.match(/<BeginBlock/g)||[]).length;
            const endCount = (text.match(/<EndBlock/g)||[]).length;
            if ( beginCount !== endCount ) { setStatus('Error: unmatched BeginBlock/EndBlock'); return; }
            setStatus('Applying...');
            workerClient.postMessage({ type: 'HISTORY_REPLACE', payload: { historyXml: text } });
            if ( listMode() ) setXml( text );
          }}>Apply Changes</button>
          <span style={{'font-size':'0.8em'}}>{status()}</span>
        </div>
      </div>
    </div>
  );
}
