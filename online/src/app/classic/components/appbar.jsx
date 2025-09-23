
import { Show, mergeProps } from 'solid-js'
import PsychologyIcon from '@suid/icons-material/Psychology'; // legacy fallback if needed
import AppBar from '@suid/material/AppBar'
import Toolbar from '@suid/material/Toolbar'
import IconButton from '@suid/material/IconButton'
import Typography from '@suid/material/Typography'
import Box from '@suid/material/Box'

import { OpenMenu } from './folder.jsx'
import { VZomeLogo } from './logo.jsx'
import { AboutDialog } from '../dialogs/about.jsx';
import { SharingDialog } from '../dialogs/sharing.jsx';

export const Spacer = () => <div style={{ flex: '1 1 auto' }}></div>

export const VZomeAppBar = ( props ) =>
{
  // simple inline robot icon (stroke-based) to avoid external asset resolution issues
  const RobotIcon = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" role='img' aria-label='AI Robot'>
      <rect x="3" y="8" width="18" height="11" rx="2" ry="2" />
      <path d="M12 3v5" />
      <circle cx="9" cy="13" r="1.8" />
      <circle cx="15" cy="13" r="1.8" />
      <path d="M8 18c1.3 1 2.7 1.5 4 1.5s2.7-.5 4-1.5" />
    </svg>
  );
  const spacer = <Spacer/>;
  const merged = mergeProps( {
    showOpen: false,
    pathToRoot: './models',
    forDebugger: false,
    customTitle: false,
    spacer
  }, props );

  return (
    <div id="appbar" >
      <AppBar position="static" sx={{ backgroundColor: '#01203d' }}>
        <Toolbar>
          <Show when={ !merged.customTitle } fallback={
            <Typography variant="h5" sx={{ paddingLeft: '12px', paddingRight: '40px' }}>{props.title}</Typography>
          }>
            <VZomeLogo/>
            <Typography variant="h5" sx={{ paddingLeft: '12px', paddingRight: '40px' }}>
              vZome <Box component="span" fontStyle="oblique">{props.title}</Box>
            </Typography>
          </Show>
          {merged.spacer}
          <Show when={merged.showOpen} >
            <OpenMenu pathToRoot={merged.pathToRoot} forDebugger={merged.forDebugger} />
          </Show>
          <Show when={!merged.title} >
            {/* This is here, not in ClassicApp or ClassicEditor, because the icon appears in the app bar */}
            <SharingDialog/>  
          </Show>
          <Show when={props.onToggleAi}>
            <span title={ props.aiMode? 'Exit AI Panel' : 'Open AI Panel' }>
              <IconButton color={ props.aiMode? 'secondary' : 'inherit' } onClick={props.onToggleAi} size='large'>
                <RobotIcon/>
              </IconButton>
            </span>
          </Show>
          <AboutDialog title={props.customTitle? props.title : 'vZome '+ props.title} about={props.about} />
        </Toolbar>
      </AppBar>
    </div>
  )
}
