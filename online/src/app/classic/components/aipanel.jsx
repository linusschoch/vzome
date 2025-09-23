import { createSignal, For, Show } from 'solid-js';
import Button from '@suid/material/Button';
import TextField from '@suid/material/TextField';
import Alert from '@suid/material/Alert';
import IconButton from '@suid/material/IconButton';
import Tooltip from '@suid/material/Tooltip';
import CloseIcon from '@suid/icons-material/Close';
import SendIcon from '@suid/icons-material/Send';

/*
  vZomeGPT Panel: lightweight chat UI embedded as a tab.
  NOTE: This is a demo; in production consider routing requests through a server.
*/
export const AiPanel = () => {
  const [ apiKey, setApiKey ] = createSignal( '' );
  const [ input, setInput ] = createSignal( '' );
  const [ model, setModel ] = createSignal( 'gpt-4o-mini' );
  const [ loading, setLoading ] = createSignal( false );
  const [ error, setError ] = createSignal( '' );
  const [ messages, setMessages ] = createSignal( [ { role: 'system', content: 'You are vZomeGPT, a helpful assistant for geometry and the vZome app. Keep replies concise.' } ] );

  const visibleMessages = () => messages().filter( m => m.role !== 'system' );

  const send = async () => {
    const prompt = input().trim();
    if ( !prompt ) return;
    const key = apiKey().trim();
    if ( !key ) { setError( 'API key required.' ); return; }
    setError( '' );
    setLoading( true );
    // push user message
    setMessages( ms => [ ...ms, { role: 'user', content: prompt } ] );
    setInput( '' );
    try {
      const res = await fetch( 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model(),
          messages: messages().concat( { role: 'user', content: prompt } ).map( m => ({ role: m.role, content: m.content }) ),
          temperature: 0.6,
          max_tokens: 200
        })
      });
      if ( !res.ok ) {
        let detail = '';
        try { const prob = await res.json(); detail = prob?.error?.message || JSON.stringify( prob ); }
        catch { detail = await res.text(); }
        if ( res.status === 401 ) detail = 'Invalid API key (401).';
        throw new Error( detail );
      }
      const data = await res.json();
      const msg = data?.choices?.[0]?.message?.content?.trim() || '(no content)';
      setMessages( ms => [ ...ms, { role: 'assistant', content: msg } ] );
    } catch (e) {
      setError( e.message );
    } finally {
      setLoading( false );
    }
  };

  const clearChat = () => setMessages( ms => ms.slice(0,1) ); // keep system

  return (
    <div class='aipanel root-flex-col' style={{ display: 'flex', 'flex-direction': 'column', gap: '8px', height: '100%' }}>
      <div style={{ display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
        <TextField type='password' size='small' label='API Key' value={apiKey()} onChange={ e=>setApiKey(e.target.value) }
          helperText='Key kept only in memory.' />
        <TextField size='small' label='Model' value={model()} onChange={ e=>setModel(e.target.value) }
          helperText='e.g. gpt-4o-mini' />
      </div>
      <div class='chat-scroll' style={{ flex: 1, overflow: 'auto', 'background-color': '#f7f9fb', padding: '6px', 'border-radius': '4px', 'border': '1px solid #ddd' }}>
        <For each={visibleMessages()}>{ m =>
          <div class='chat-msg' style={{ 'margin-bottom': '8px' }}>
            <strong>{m.role === 'user' ? 'You' : 'vZomeGPT'}:</strong> <span style={{ 'white-space': 'pre-wrap' }}>{m.content}</span>
          </div>
        }</For>
      </div>
      <Show when={error()}>
        <Alert severity='error'>{error()}</Alert>
      </Show>
      <div style={{ display:'flex', gap:'6px' }}>
        <TextField fullWidth size='small' placeholder='Ask a question about vZome...' value={input()} onKeyDown={ e => { if ( e.key==='Enter' && !e.shiftKey ) { e.preventDefault(); send(); } } } onChange={ e=>setInput(e.target.value) } />
        <Tooltip title='Send'>
          <span>
            <IconButton color='primary' disabled={loading() || !input().trim()} onClick={send}>
              <SendIcon/>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title='Clear chat'>
          <span>
            <IconButton disabled={loading() || visibleMessages().length===0} onClick={clearChat}>
              <CloseIcon/>
            </IconButton>
          </span>
        </Tooltip>
      </div>
      <Alert severity='info'>Demo: key never sent to server. Avoid sensitive data.</Alert>
    </div>
  );
};
