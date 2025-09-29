import { createSignal, For, Show } from 'solid-js';
import Button from '@suid/material/Button';
import TextField from '@suid/material/TextField';
import Alert from '@suid/material/Alert';
import IconButton from '@suid/material/IconButton';
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
  const [ maxTokens, setMaxTokens ] = createSignal( 400 ); // adjustable
  // Messages: keep a system message plus user/assistant turns
  const [ messages, setMessages ] = createSignal( [ { role: 'system', content: 'You are vZomeGPT, a helpful assistant for geometry and the vZome app. Keep replies concise.' } ] );
  // Keep a sliding window of prior turns (excluding system) we include as context
  const CONTEXT_TURNS = 8; // number of previous pairs to include

  const visibleMessages = () => messages().filter( m => m.role !== 'system' );

  const buildContextPrompt = ( prompt ) => {
    // We'll concatenate last few turns for simple context.
    const turns = visibleMessages();
    const recent = turns.slice( -CONTEXT_TURNS * 2 ); // user+assistant counts
    const transcript = recent.map( m => `${m.role.toUpperCase()}: ${m.content}` ).join('\n');
    return transcript ? `${transcript}\nUSER: ${prompt}` : prompt;
  };

  const parseReply = ( data ) => {
    try {
      const message = data?.output?.find?.( item => item.type === 'message' );
      const contentArr = message?.content || [];
      const textPart = contentArr.find( c => c.type === 'output_text' );
      const text = textPart?.text?.trim();
      if ( text ) return text;
      return `[(empty) id=${data?.id||'none'} status=${data?.status||'unknown'}]`;
    } catch (e) {
      return `[parse error: ${e?.message||e}]`;
    }
  };

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

    const isGpt5 = /^gpt-5/i.test( model() );
    const body = {
      model: model(),
      input: buildContextPrompt( prompt ),
      instructions: messages()[0]?.content || 'You are an assistant.',
      max_output_tokens: maxTokens(),
    };
    if ( !isGpt5 ) body.temperature = 0.6;
    if ( isGpt5 ) body.reasoning = { effort: 'medium' };

    const attempt = async () => {
      const controller = new AbortController();
      const timeout = setTimeout( () => controller.abort(), 60000 ); // 60s guard
      try {
        const res = await fetch( 'https://api.openai.com/v1/responses', {
          method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            body: JSON.stringify( body ),
            signal: controller.signal
        });
        clearTimeout( timeout );
        if ( !res.ok ) {
          let detail = '';
          try { const prob = await res.json(); detail = prob?.error?.message || JSON.stringify( prob ); }
          catch { detail = await res.text(); }
          if ( res.status === 401 ) detail = 'Invalid API key (401).';
          if ( res.status === 408 ) detail = 'Request timeout (408). Try reducing max tokens or simplifying the prompt.';
          throw new Error( detail );
        }
        const data = await res.json();
        return parseReply( data );
      } catch (e) {
        if ( e?.name === 'AbortError' ) throw new Error( 'Client-side timeout after 60s. Try shorter prompt or fewer context turns.' );
        throw e;
      }
    };

    try {
      let reply = await attempt();
      if ( /\(empty\)|\[\(empty\)/.test( reply ) ) {
        // Retry once with trimmed context (only last 2 turns) if empty sentinel
        const original = body.input;
        const turns = visibleMessages();
        const minimal = turns.slice( -2 ).map( m => `${m.role.toUpperCase()}: ${m.content}` ).join('\n');
        body.input = minimal ? `${minimal}\nUSER: ${prompt}` : prompt;
        reply = await attempt();
        body.input = original; // restore for any future debugging
        if ( /\(empty\)|\[\(empty\)/.test( reply ) ) {
          reply += ' (debug: still empty after minimal-context retry)';
        } else {
          reply += ' (retried)';
        }
      }
      setMessages( ms => [ ...ms, { role: 'assistant', content: reply } ] );
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
          helperText='e.g. gpt-4o-mini or gpt-5' />
        <TextField size='small' label='Max Output Tokens' type='number' value={maxTokens()} onChange={ e=> setMaxTokens( Math.max(1, Math.min( 4000, parseInt( e.target.value || '1', 10 ) ) ) ) }
          helperText='1-4000, higher may be slower/time out.' />
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
        <span title='Send'>
          <IconButton color='primary' disabled={loading() || !input().trim()} onClick={send}>
            <SendIcon/>
          </IconButton>
        </span>
        <span title='Clear chat'>
          <IconButton disabled={loading() || visibleMessages().length===0} onClick={clearChat}>
            <CloseIcon/>
          </IconButton>
        </span>
      </div>
      <Alert severity='info'>Demo: key never sent to server. Avoid sensitive data. Sliding context window size {CONTEXT_TURNS} turns.</Alert>
    </div>
  );
};
