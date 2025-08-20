import Button from '@suid/material/Button';
import Stack from '@suid/material/Stack';
import UndoIcon from '@suid/icons-material/Undo';
import RedoIcon from '@suid/icons-material/Redo';
import { subController, useEditor } from '../../framework/context/editor.jsx';

export const UndoRedoInline = () => {
  const { rootController, controllerAction } = useEditor();
  const ctrl = () => subController( rootController(), 'undoRedo' );
  const doAction = action => () => controllerAction( ctrl(), action );
  return (
    <Stack direction='row' spacing={1} sx={{ ml: 1 }}>
      <Button size='small' variant='outlined' startIcon={<UndoIcon/>} onClick={doAction('undo')}>Undo</Button>
      <Button size='small' variant='outlined' startIcon={<RedoIcon/>} onClick={doAction('redo')}>Redo</Button>
    </Stack>
  );
}

export default UndoRedoInline;
