
import { createSignal, createEffect, createMemo } from "solid-js";

import { controllerProperty, subController, useEditor } from '../../framework/context/editor.jsx';
import { resumeMenuKeyEvents, suspendMenuKeyEvents } from '../context/commands.jsx';
import { useSymmetry } from "../context/symmetry.jsx";
import { ToolConfig } from "../dialogs/toolconfig.jsx";
import { resourceUrl } from "./length.jsx";
import { Tabs, Tab } from "../../framework/tabs.jsx";
import { Tooltip } from "@kobalte/core/tooltip";
import { useCommands } from "../context/commands.jsx";

// Convert raw command/factory ids into human-readable labels
const prettyLabel = (raw) => {
  if (!raw) return "";
  let s = `${raw}`;
  // If label has a category prefix, keep only the last segment
  if (s.includes('/')) s = s.substring(s.lastIndexOf('/') + 1);
  // Replace underscores and hyphens with spaces
  s = s.replace(/[_.-]+/g, ' ');
  // Insert spaces before capitals in camel/PascalCase
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Title-case words
  s = s.replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return s.trim();
}

// One-line help for common commands (fallback until worker supplies help text)
const commandHelp = {
  'Delete': 'Delete selected items',
  'hideball': 'Hide/show ball selection',
  'JoinPoints/CLOSED_LOOP': 'Connect balls in a loop',
  'JoinPoints/CHAIN_BALLS': 'Connect balls in a chain',
  'JoinPoints/ALL_TO_LAST': 'Connect all balls to last selected',
  'JoinPoints/ALL_POSSIBLE': 'Connect balls in all possible ways',
  'panel': 'Make a panel polygon',
  'NewCentroid': 'Construct centroid of points',
};

const ToolbarSpacer = () => ( <div style={{ 'min-width': '10px', 'min-height': '10px' }}></div> )

const ToolbarButton = props => {
  const labelText = () => props.pretty ?? prettyLabel(props.label);
  return (
    <Tooltip openDelay={500} closeDelay={100}>
      <Tooltip.Trigger>
        <button aria-label={labelText()} class='toolbar-button' onClick={props.onClick} onContextMenu={props.onContextMenu} disabled={props.disabled}>
          <img src={ resourceUrl( `icons/tools/${props.image}.png` ) } class='toolbar-image'/>
          <span class='toolbar-label'>{labelText()}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content class="rt-content" gutter={8}>
          <div class='rt-title'>
            <span class='rt-name'>{labelText()}</span>
            <Show when={props.tShortcut}><span class='rt-shortcut'>{props.tShortcut}</span></Show>
          </div>
          <Show when={props.tHelp}><div class='rt-help'>{props.tHelp}</div></Show>
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip>
  );
}

const ToolFactoryButton = props =>
{
  const { controllerAction } = useEditor();
  const { symmetryController } = useSymmetry();
  const controller = () => subController( symmetryController(), props.factoryName );
  const rawHelp = () => controllerProperty( controller(), 'tooltip', 'tooltip', false );
  const oneLine = () => stripHtmlOneLine( rawHelp() );
  const enabled = () =>
  {
    const enabled = controllerProperty( controller(), 'enabled' );
    return enabled && (enabled === 'true');
  }
  const handleClick = () =>
    controllerAction( controller(), 'createTool' );
  return (
    <ToolbarButton label={props.factoryName} image={`newTool/${props.factoryName}`} onClick={handleClick} disabled={!enabled()} tHelp={oneLine()} />
  )
}

export const ToolFactoryBar = props =>
{
  const { symmetryController, symmetryDefined } = useSymmetry();
  const symmFactoryNames = () => controllerProperty( symmetryController(), 'symmetryToolFactories', 'symmetryToolFactories', true );
  const transFactoryNames = () => controllerProperty( symmetryController(), 'transformToolFactories', 'transformToolFactories', true );
  const mapFactoryNames = () => controllerProperty( symmetryController(), 'linearMapToolFactories', 'linearMapToolFactories', true );
  const [ tab, setTab ] = createSignal( 'Symmetry' );

  return (
    <Show when={symmetryDefined()}>
      <div class='toolbar-tabs'>
      <Tabs label="Tool Factories" values={[ 'Symmetry', 'Transform', 'Map' ]} value={tab()} onChange={setTab}>
        <Tab value='Symmetry'>
          <div id='factory-bar-symmetry' class='toolbar'>
            <For each={symmFactoryNames()}>{ factoryName =>
              <ToolFactoryButton factoryName={factoryName}/>
            }</For>
          </div>
        </Tab>
        <Tab value='Transform'>
          <div id='factory-bar-transform' class='toolbar'>
            <For each={transFactoryNames()}>{ factoryName =>
              <ToolFactoryButton factoryName={factoryName}/>
            }</For>
          </div>
        </Tab>
        <Tab value='Map'>
          <div id='factory-bar-map' class='toolbar'>
            <For each={mapFactoryNames()}>{ factoryName =>
              <ToolFactoryButton factoryName={factoryName}/>
            }</For>
          </div>
        </Tab>
      </Tabs>
      </div>
    </Show>
  )
}

const CommandButton = props =>
{
  const { controllerAction } = useEditor();
  const { getCommand } = useCommands();
  const handleClick = () => controllerAction( props.ctrlr, props.cmdName );
  const shortcut = () => getCommand( props.cmdName )?.keystroke || '';
  const help = () => commandHelp[ props.cmdName ] || '';
  return (
    <ToolbarButton label={props.cmdName} image={`small/${props.cmdName}`} onClick={handleClick} tShortcut={shortcut()} tHelp={help()} />
  );
}

const SetColorButton = props =>
{
  const { controllerAction } = useEditor();
  let colorInputElement;
  const handleClick = () =>
  {
    colorInputElement.click();
  }
  const setColor = color =>
  {
    controllerAction( props.ctrlr, `ColorManifestations/${color}ff` );
  }
  createEffect( () => {
    // skip the leading "#"
    colorInputElement.addEventListener( "change", e => setColor( e.target.value.substring(1) ), false );
  });
  return ( <>
    <ToolbarButton label={props.cmdName} image={`small/setItemColor`} onClick={handleClick} />
    <input ref={colorInputElement} type="color" name="color-picker" class='hidden-color-input' />
  </>);
}

const ToolButton = props =>
{
  const { controllerAction } = useEditor();
  const kind = () => controllerProperty( props.controller, 'kind', 'kind', false );
  const label = () => controllerProperty( props.controller, 'label', 'label', false );
  const rawHelp = () => controllerProperty( props.controller, 'tooltip', 'tooltip', false );
  const oneLine = () => stripHtmlOneLine( rawHelp() );
  const handleClick = () => controllerAction( props.controller, 'apply' );
  const [anchorEl, setAnchorEl] = createSignal(null);
  const handleOpen = (e) =>
  {
    suspendMenuKeyEvents();
    setAnchorEl( e.currentTarget );
    e.preventDefault(); e.stopPropagation();
  }
  const handleClose = () => {
    resumeMenuKeyEvents();
    setAnchorEl( null );
  }
  return (
    <Show when={!!kind()}>
  <ToolbarButton label={label()} image={`small/${kind()}`} onClick={handleClick} onContextMenu={handleOpen} tHelp={oneLine()} />
      <ToolConfig predefined={props.predefined} image={`small/${kind()}`} controller={props.controller} label={label()}
        anchor={anchorEl()} onClose={handleClose} onClick={handleClick} />
    </Show>
  )
}

export const ToolBar = props =>
{
  const { symmetryController, symmetryDefined } = useSymmetry();
  const symmToolNames = () => controllerProperty( symmetryController(), 'builtInSymmetryTools', 'builtInSymmetryTools', true );
  const transToolNames = () => controllerProperty( symmetryController(), 'builtInTransformTools', 'builtInTransformTools', true );
  const customToolNames = () => controllerProperty( props.toolsController, 'customTools', 'customTools', true );
  const [ tab, setTab ] = createSignal( 'Commands' );
  const [ filter, setFilter ] = createSignal( '' );

  const norm = s => (s || '').toString().toLowerCase();
  const matches = (rawLabel) => {
    const f = norm(filter().trim());
    if (!f) return true;
    return norm(prettyLabel(rawLabel)).includes(f) || norm(rawLabel).includes(f);
  }

  // Command list so we can filter easily
  const commandList = [
    'Delete',
    'hideball',
    'JoinPoints/CLOSED_LOOP',
    'JoinPoints/CHAIN_BALLS',
    'JoinPoints/ALL_TO_LAST',
    'JoinPoints/ALL_POSSIBLE',
    'panel',
    'NewCentroid',
  ];

  // help text for commands defined above

  return (
  <div class='toolbar-tabs'>
    <div class='toolbar-filter-row'>
      <input
        class='toolbar-filter-input'
        type='search'
        placeholder='Filter tools…'
        value={filter()}
        onInput={(e) => setFilter(e.currentTarget.value)}
        aria-label='Filter tools'
      />
    </div>
  <Tabs label="Tools" values={[ 'Commands', 'Symmetry', 'Transform', 'Custom' ]} value={tab()} onChange={setTab}>
      <Tab value='Commands'>
        <div id='tools-bar-commands' class='toolbar'>
          <Show when={matches('Set Item Color')}>
            <SetColorButton ctrlr={props.editorController} />
          </Show>
          <For each={commandList.filter(cmd => matches(cmd))}>{ cmd =>
            <CommandButton ctrlr={props.editorController} cmdName={cmd}/>
          }</For>
        </div>
      </Tab>
      <Tab value='Symmetry'>
        <Show when={symmetryDefined()}>
          <div id='tools-bar-symmetry' class='toolbar'>
            <For each={(symmToolNames() || []).filter(toolName => matches(toolName))}>{ toolName =>
              <ToolButton predefined controller={subController( props.toolsController, toolName )}/>
            }</For>
          </div>
        </Show>
      </Tab>
      <Tab value='Transform'>
        <Show when={symmetryDefined()}>
          <div id='tools-bar-transform' class='toolbar'>
            <For each={(transToolNames() || []).filter(toolName => matches(toolName))}>{ toolName =>
              <ToolButton predefined controller={subController( props.toolsController, toolName )}/>
            }</For>
          </div>
        </Show>
      </Tab>
      <Tab value='Custom'>
        <Show when={symmetryDefined()}>
          <div id='tools-bar-custom' class='toolbar'>
            <For each={(customToolNames() || [])}>{ toolName => {
              const ctrl = subController( props.toolsController, toolName );
              const lbl = () => controllerProperty( ctrl, 'label', 'label', false );
              return (
                <Show when={ matches(lbl()) || matches(toolName) }>
                  <ToolButton controller={ctrl}/>
                </Show>
              );
            }}</For>
          </div>
        </Show>
      </Tab>
    </Tabs>
  </div>
  )
}

let nextBookmarkIcon = 0;

const BookmarkButton = props =>
{
  const { controllerAction } = useEditor();
  const label = () => controllerProperty( props.controller, 'label', 'label', false ) || ''; // always defined, to control the ToolConfig
  const [ iconName, setIconName ] = createSignal( null );
  createEffect( () => {
    setIconName( `bookmark_${nextBookmarkIcon}` );
    nextBookmarkIcon = ( nextBookmarkIcon + 1 ) % 4;
  }, [] );
  const handleClick = () => controllerAction( props.controller, 'apply' );
  const [anchorEl, setAnchorEl] = createSignal(null);
  const handleOpen = (e) =>
  {
    suspendMenuKeyEvents();
    setAnchorEl( e.currentTarget );
    e.preventDefault(); e.stopPropagation();
  }
  const handleClose = () => {
    resumeMenuKeyEvents();
    setAnchorEl( null );
  }
  return ( <>
  <ToolbarButton label={label()} image={`small/${iconName()}`} onClick={handleClick} onContextMenu={handleOpen} />
    <ToolConfig bookmark predefined={props.predefined} image={`small/${iconName()}`} controller={props.controller} label={label()}
      anchor={anchorEl()} onClose={handleClose} onClick={handleClick} />
  </> )
}

// Utility helpers for bookmark order persistence
const orderStorageKey = () => {
  const { pathname, search, hash } = window.location;
  return `vzome.bookmarks.order::${pathname}${search}${hash}`;
}
const loadOrder = () => {
  try { return JSON.parse(localStorage.getItem(orderStorageKey()) || '[]'); }
  catch { return []; }
}
const saveOrder = (names) => {
  try { localStorage.setItem(orderStorageKey(), JSON.stringify(names)); }
  catch { /* ignore */ }
}
const reconcileOrder = (saved, current) => {
  // Keep only current names, in saved order; append any new names at the end
  const set = new Set(current);
  const pruned = saved.filter(n => set.has(n));
  const seen = new Set(pruned);
  const appended = current.filter(n => !seen.has(n));
  return [ ...pruned, ...appended ];
}

// Reorder helper
const moveIndex = (arr, from, to) => {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr.slice();
  const copy = arr.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export const BookmarkBar = props =>
{
  const { symmetryController, symmetryDefined } = useSymmetry();
  const bookmarkNames = () => controllerProperty( props.toolsController, 'customBookmarks', 'customBookmarks', true );

  // Maintain a persisted custom order for bookmarks (excluding the pinned builtin)
  const [savedOrder, setSavedOrder] = createSignal(loadOrder());
  const orderedCustom = createMemo(() => reconcileOrder(savedOrder(), bookmarkNames() || []));

  // Drag state
  const [dragFrom, setDragFrom] = createSignal(null);   // index within orderedCustom
  const [dragOver, setDragOver] = createSignal(null);   // index under cursor

  const onDropAt = (toIndex) => {
    const fromIndex = dragFrom();
    if (fromIndex == null || toIndex == null) return;
    const next = moveIndex(orderedCustom(), fromIndex, toIndex);
    setSavedOrder(next);
    saveOrder(next);
    setDragFrom(null); setDragOver(null);
  }

  return (
    <div id='tools-bar' class='toolbar-vert' role="listbox" aria-label="Bookmarks">
      <Show when={symmetryDefined()}>
        <ToolbarSpacer/>
        <ToolFactoryButton factoryName='bookmark' controller={symmetryController()}/>
      </Show>
      <ToolbarSpacer/>
      {/* Pinned builtin */}
      <div class='bookmark-item' role="option" aria-selected="false" data-pinned>
        <BookmarkButton predefined controller={subController( props.toolsController, 'bookmark.builtin/ball at origin' )}/>
      </div>

      {/* Reorderable custom bookmarks */}
      <For each={orderedCustom()}>{ (toolName, idx) =>
        <div
          class='bookmark-item'
          role="option"
          aria-selected="false"
          draggable
          tabIndex={0}
          onDragStart={(e) => { setDragFrom(idx()); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(idx()); e.dataTransfer.dropEffect = 'move'; }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => { e.preventDefault(); onDropAt(idx()); }}
          onKeyDown={(e) => {
            if (!e.altKey) return;
            if (e.key === 'ArrowUp' && idx() > 0) { e.preventDefault(); const next = moveIndex(orderedCustom(), idx(), idx()-1); setSavedOrder(next); saveOrder(next); }
            if (e.key === 'ArrowDown' && idx() < orderedCustom().length - 1) { e.preventDefault(); const next = moveIndex(orderedCustom(), idx(), idx()+1); setSavedOrder(next); saveOrder(next); }
            if (e.key === 'Home') { e.preventDefault(); const next = moveIndex(orderedCustom(), idx(), 0); setSavedOrder(next); saveOrder(next); }
            if (e.key === 'End') { e.preventDefault(); const next = moveIndex(orderedCustom(), idx(), orderedCustom().length - 1); setSavedOrder(next); saveOrder(next); }
          }}
          data-dragover={dragOver() === idx() ? '' : undefined}
        >
          <span class='drag-handle' aria-hidden>⋮⋮</span>
          <BookmarkButton controller={subController( props.toolsController, toolName )}/>
          <span class='drop-indicator' aria-hidden></span>
        </div>
      }</For>
    </div>
  )
}

// Helpers
function stripHtmlOneLine( html )
{
  if (!html) return '';
  let s = `${html}`
    .replace(/<[^>]*>/g, ' ')   // strip tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim();
  // take first sentence-ish up to 140 chars
  const dot = s.indexOf('.')
  if (dot > 0 && dot < 140) s = s.slice(0, dot + 1);
  if (s.length > 160) s = s.slice(0, 157) + '…';
  return s;
}
