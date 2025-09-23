import { createSignal, Show } from 'solid-js';
import Dialog from '@suid/material/Dialog';
import DialogTitle from '@suid/material/DialogTitle';
import DialogContent from '@suid/material/DialogContent';
import DialogActions from '@suid/material/DialogActions';
import Button from '@suid/material/Button';
import TextField from '@suid/material/TextField';
import Alert from '@suid/material/Alert';

/*
  Simple "Hello World" OpenAI Chat Completion dialog.
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

  const callApi = async () => {
    setError( '' );
    setResponse( '' );
    const key = apiKey().trim();
    if ( ! key ) { setError( 'API key required.' ); return; }
    setLoading( true );
    try {
      // Official Chat Completions call. For production consider server-side proxy to avoid exposing key.
      const res = await fetch( 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: model(),
          messages: [
            { role: 'system', content: 'You are a concise assistant embedded inside the vZome geometry app. Keep replies short.' },
            { role: 'user', content: userPrompt() }
          ],
          temperature: 0.7,
          max_tokens: 120
        })
      });
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
        throw new Error( `HTTP ${res.status}: ${detail}` );
      }
      const data = await res.json();
      const msg = data?.choices?.[0]?.message?.content?.trim() || '(no content)';
      setResponse( msg );
    } catch (e) {
      setError( e.message );
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
          helperText='Try gpt-4o, gpt-4o-mini, or another available model.' />
        <Button variant='contained' disabled={loading()} onClick={callApi}>
          { loading()? 'Calling...' : 'Send' }
        </Button>
        <Show when={error()}>
          <Alert severity='error'>{error()}</Alert>
        </Show>
        <Show when={response()}>
          <Alert severity='success' sx={{ 'white-space': 'pre-wrap' }}>{response()}</Alert>
        </Show>
        <Alert severity='info'>Demo only. Key never stored. For streaming or secure usage, add a server proxy.</Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={ () => props.close() } color='primary'>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
