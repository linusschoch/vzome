
const debug = false;

class VZomeViewerIndexButton extends HTMLElement
{
  #next;
  #viewerId;
  #viewer;
  #loadCamera;

  constructor( next=true )
  {
    super();
    this.#next = next;
    this.#loadCamera = false;
  }

  connectedCallback()
  {
    if ( !! this.#viewerId ) {
      this.#viewer = document .querySelector( `#${this.#viewerId}` );
      if ( ! this.#viewer ) {
        console.error( `No vzome-viewer with id "${this.#viewerId}" found.` );
      } else if ( this.#viewer .nextScene === undefined ) {
        console.error( `Element with id "${this.#viewerId}" is not a vzome-viewer.` );
        return;
      }
    }
    if ( ! this.#viewer ) {
      this.#viewer = document .querySelector( 'vzome-viewer' );
    }
    if ( ! this.#viewer ) {
      console.error( `No vzome-viewer found.` );
      return;
    }

    const button = document .createElement( 'button' );
    button .textContent = this.getAttribute( 'label' );
    this .appendChild( button );
    button.classList .add( 'vzome-viewer-index-button' );

    const loadParams = { camera: this.#loadCamera };
    button .addEventListener( "click", () => this.#next? this.#viewer .nextScene( loadParams ) : this.#viewer .previousScene( loadParams ) );
  }

  static get observedAttributes()
  {
    return [ "viewer", "load-camera" ];
  }

  attributeChangedCallback( attributeName, _oldValue, _newValue )
  {
    debug && console.log( 'VZomeViewerIndexButton attribute changed' );
    switch (attributeName) {

    case "viewer":
      this.#viewerId = _newValue;
      break;

    case "load-camera":
      this.#loadCamera = _newValue === 'true';
      break;
    }
  }
}

export class VZomeViewerNextButton extends VZomeViewerIndexButton
{
  constructor()
  {
    super( true );
  }
}

export class VZomeViewerPrevButton extends VZomeViewerIndexButton
{
  constructor()
  {
    super( false );
  }
}