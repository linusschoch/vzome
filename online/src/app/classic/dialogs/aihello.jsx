import { createSignal } from 'solid-js';
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
  const [ apiKey, setApiKey ]       = createSignal( '' );
  const [ userPrompt, setUserPrompt ] = createSignal( 'Say hello to vZome!' );
  const [ response, setResponse ]   = createSignal( '' );
  const [ loading, setLoading ]     = createSignal( false );
  const [ error, setError ]         = createSignal( '' );

  const callApi = async () => {
    setError( '' );
    setResponse( '' );
    if ( ! apiKey() ) { setError( 'API key required.' ); return; }
    setLoading( true );
    try {
      // Using fetch to call OpenAI Chat Completions (gpt-4o-mini for low cost/fast demo)
      const res = await fetch( 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey()}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [ { role: 'user', content: userPrompt() } ],
          temperature: 0.7,
          max_tokens: 64
        })
      });
      if ( !res.ok ) {
        const text = await res.text();
        throw new Error( `HTTP ${res.status}: ${text}` );
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
        <Button variant='contained' disabled={loading()} onClick={callApi}>
          { loading()? 'Calling...' : 'Send' }
        </Button>
        <Show when={error()}>
          <Alert severity='error'>{error()}</Alert>
        </Show>
        <Show when={response()}>
          <Alert severity='success' sx={{ 'white-space': 'pre-wrap' }}>{response()}</Alert>
        </Show>
        <Alert severity='info'>Demo only. Avoid sharing secrets in prompts.</Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={ () => props.close() } color='primary'>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
