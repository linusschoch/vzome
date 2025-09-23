import { createSignal, For } from 'solid-js';
import Button from '@suid/material/Button';
import TextField from '@suid/material/TextField';
import Paper from '@suid/material/Paper';
import Divider from '@suid/material/Divider';
import IconButton from '@suid/material/IconButton';
import CloseIcon from '@suid/icons-material/Close';

/*
  AiSandbox: offline placeholder for future AI conversation implementation.
  - No network calls
  - Persists only in-memory during session
  - Allows adding mock assistant replies (echo style)
*/
export const AiSandbox = ( props ) => {
  const [ messages, setMessages ] = createSignal( [ { role:'assistant', content:'AI sandbox ready. Type something.' } ] );
  const [ input, setInput ] = createSignal( '' );

  const send = () => {
    const text = input().trim();
    if( !text ) return;
    setMessages( ms => [ ...ms, { role:'user', content: text }, { role:'assistant', content: `(mock) You said: ${text}` } ] );
    setInput( '' );
  };
  const clear = () => setMessages( [ { role:'assistant', content:'Cleared. Start again.' } ] );

  return (
    <div style={{ display:'flex', 'flex-direction':'column', height:'100%', gap:'8px', padding:'4px' }}>
      <Paper variant='outlined' sx={{ flex:1, overflow:'auto', padding:'8px', 'background-color':'#fafbfd' }}>
        <For each={messages()}>{ m =>
          <div style={{ 'margin-bottom':'6px' }}>
            <strong>{ m.role === 'user' ? 'You' : 'Sandbox' }:</strong> {m.content}
          </div>
        }</For>
      </Paper>
      <div style={{ display:'flex', gap:'6px' }}>
        <TextField fullWidth size='small' placeholder='Type to mock...' value={input()} onChange={ e=>setInput(e.target.value) } onKeyDown={ e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } } } />
        <Button variant='contained' onClick={send} disabled={!input().trim()}>Send</Button>
        <Button onClick={clear}>Clear</Button>
      </div>
      <Divider />
      <div style={{ display:'flex', 'justify-content':'space-between', 'align-items':'center' }}>
        <span style={{ 'font-size':'12px', color:'#555' }}>Offline AI Sandbox (no network).</span>
        <Button size='small' color='secondary' variant='outlined' onClick={props.onExit}>Return to Standard UI</Button>
      </div>
    </div>
  );
};
