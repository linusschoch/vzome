import React from 'react'
import { makeStyles } from '@material-ui/core/styles'
import AppBar from '@material-ui/core/AppBar'
import Toolbar from '@material-ui/core/Toolbar'
import Typography from '@material-ui/core/Typography'
import Box from '@material-ui/core/Box'

import { AboutDialog } from './about.jsx'
import { OpenMenu } from './folder.jsx'
import { VZomeLogo } from './logo.jsx'

const useStyles = makeStyles((theme) => ({
  root: {
    zIndex: theme.zIndex.drawer + 1,
  },
  title: {
    marginLeft: theme.spacing(2),
    flexGrow: 1,
  },
  open: {
    marginRight: theme.spacing(5),
  },
}))

export const VZomeAppBar = ( { openUrl, openFile } ) =>
{
  const classes = useStyles()

  return (
    <div id="appbar" className={classes.root}>
      <AppBar position="static">
        <Toolbar>
          <VZomeLogo/>
          <Typography variant="h5" className={classes.title}>
            vZome <Box component="span" fontStyle="oblique">Online</Box>
          </Typography>
          { !!openUrl &&
            <>
              <OpenMenu className={classes.open} openUrl={openUrl} openFile={openFile} />
              <AboutDialog/>
            </> }
        </Toolbar>
      </AppBar>
    </div>
  )
}
