import { createSignal, Show } from 'solid-js';
import Dialog from '@suid/material/Dialog';
import DialogTitle from '@suid/material/DialogTitle';
import DialogContent from '@suid/material/DialogContent';
import DialogActions from '@suid/material/DialogActions';
import Button from '@suid/material/Button';
import TextField from '@suid/material/TextField';
import Alert from '@suid/material/Alert';

/*
  Simple "Hello World" OpenAI Responses API dialog.
  NOTE: For security, we DO NOT persist or transmit the API key beyond this session.
  The request is made directly from the browser; consider adding a proxy server for production.
*/
export const AiHelloDialog = props => {
  const [ apiKey, setApiKey ]         = createSignal( '' );
  const [ userPrompt, setUserPrompt ] = createSignal( 'Say hello to vZome!' );
  const [ response, setResponse ]     = createSignal( '' );
  const [ loading, setLoading ]       = createSignal( false );
  const [ error, setError ]           = createSignal( '' );
  const [ model, setModel ]           = createSignal( 'gpt-4o-mini' ); // small, fast model for demo
  const [ maxTokens, setMaxTokens ]   = createSignal( 200 );

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

  const callApi = async () => {
    setError( '' );
    setResponse( '' );
    const key = apiKey().trim();
    if ( ! key ) { setError( 'API key required.' ); return; }
    setLoading( true );
    try {
      const isGpt5 = /^gpt-5/i.test( model() );
      const body = {
        model: model(),
        input: userPrompt(),
        instructions: 'You are a concise assistant embedded inside the vZome geometry app. Keep replies short.',
        max_output_tokens: maxTokens(),
      };
      if ( !isGpt5 ) body.temperature = 0.7;
      if ( isGpt5 ) body.reasoning = { effort: 'medium' };
      const controller = new AbortController();
      const timeout = setTimeout( () => controller.abort(), 60000 );
      const res = await fetch( 'https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify( body ),
        signal: controller.signal
      });
      clearTimeout( timeout );
      if ( !res.ok ) {
        let detail = '';
        try {
          const problem = await res.json();
          detail = problem?.error?.message || JSON.stringify( problem );
        } catch(e) {
          detail = await res.text();
        }
        if ( res.status === 401 ) {
          throw new Error( 'HTTP 401 Unauthorized: Invalid API key. Verify you copied it correctly from https://platform.openai.com/account/api-keys' );
        }
        if ( res.status === 408 ) {
          throw new Error( 'HTTP 408 timeout: try reducing max tokens or simplifying prompt.' );
        }
        throw new Error( `HTTP ${res.status}: ${detail}` );
      }
      const data = await res.json();
      let msg = parseReply( data );
      if ( /\(empty\)|\[\(empty\)/.test( msg ) ) {
        // Retry once with same body (simple dialog) if empty
        try {
          const res2 = await fetch( 'https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify( body )
          });
          if ( res2.ok ) {
            const data2 = await res2.json();
            const msg2 = parseReply( data2 );
            if ( !/\(empty\)|\[\(empty\)/.test( msg2 ) ) {
              msg = msg2 + ' (retried)';
            } else {
              msg = msg + ' (debug: still empty after retry)';
            }
          } else {
            msg = msg + ' (retry failed status ' + res2.status + ')';
          }
        } catch (e) {
          msg = msg + ' (retry error: ' + (e?.message||e) + ')';
        }
      }
      setResponse( msg );
    } catch (e) {
      if ( e?.name === 'AbortError' ) setError( 'Client-side timeout after 60s. Try fewer tokens.' );
      else setError( e.message );
    } finally {
      setLoading( false );
    }
  };

  return (
    <Dialog open={props.open} onClose={ () => props.close() } fullWidth maxWidth='sm'>
      <DialogTitle>AI Hello (OpenAI)</DialogTitle>
      <DialogContent sx={{ display: 'flex', 'flex-direction': 'column', gap: '12px', 'padding-top': '8px' }}>
        <TextField type='password' label='OpenAI API Key' size='small' fullWidth
          value={apiKey()} onChange={ e => setApiKey( e.target.value ) }
          helperText='Key not stored; paste each session.' />
        <TextField label='Prompt' size='small' fullWidth multiline minRows={2}
          value={userPrompt()} onChange={ e => setUserPrompt( e.target.value ) } />
        <TextField label='Model' size='small' fullWidth
          value={model()} onChange={ e => setModel( e.target.value ) }
          helperText='Try gpt-4o-mini, gpt-4o, or gpt-5.' />
        <TextField label='Max Output Tokens' size='small' type='number' fullWidth value={maxTokens()} onChange={ e => setMaxTokens( Math.max(1, Math.min( 2000, parseInt( e.target.value || '1', 10 ) ) ) ) }
          helperText='1-2000. Larger may timeout.' />
        <Button variant='contained' disabled={loading()} onClick={callApi}>
          { loading()? 'Calling...' : 'Send' }
        </Button>
        <Show when={error()}>
          <Alert severity='error'>{error()}</Alert>
        </Show>
        <Show when={response()}>
          <Alert severity='success' sx={{ 'white-space': 'pre-wrap' }}>{response()}</Alert>
        </Show>
        <Alert severity='info'>Demo only. Key never stored. Increase Max Output Tokens for longer answers.</Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={ () => props.close() } color='primary'>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
