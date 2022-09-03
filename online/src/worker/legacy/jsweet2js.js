
import { java } from "./candies/j4ts-2.1.0-SNAPSHOT/bundle.js"
import { simplify, createNumberFromPairs } from '../fields/common'

class JavaAlgebraicNumberFactory
{
  zero ()
  {
    return new JavaBigRational( 0n, 1n );
  }

  one ()
  {
    return new JavaBigRational( 1n, 1n );
  }

  createBigRational( num, denom )
  {
    return new JavaBigRational( BigInt(num), BigInt(denom) );
  }

  createRational( legacyField, num, denom )
    {
      const order = legacyField.getOrder()
      const factors = [ new JavaBigRational( num, denom ) ]
      for ( let index = 1; index < order; index++ ) {
        factors.push( ZERO )
      }
      return new JavaAlgebraicNumber( legacyField, factors )
    }

  createAlgebraicNumber( legacyField, numerators, divisor )
    {
      const bigRats = []
      for (let i = 0; i < numerators.length; i++) {
        bigRats.push( new JavaBigRational( numerators[ i ], divisor ) )
      }
      return new JavaAlgebraicNumber( legacyField, bigRats )
    }

  createAlgebraicNumberFromTD( legacyField, trailingDivisor )
    {
      const bigRats = []
      const divisor = trailingDivisor[ trailingDivisor.length-1 ]
      for (let i = 0; i < trailingDivisor.length-1; i++) {
        bigRats.push( new JavaBigRational( trailingDivisor[ i ], divisor ) )
      }
      return new JavaAlgebraicNumber( legacyField, bigRats )
    }

  createAlgebraicNumberFromPairs( legacyField, pairs )
    {
      const order = pairs.length / 2
      const bigRats = []
      for (let i = 0; i < order; i++) {
        bigRats.push( new JavaBigRational( pairs[ 2*i ], pairs[ 2*i+1 ] ) )
      }
      return new JavaAlgebraicNumber( legacyField, bigRats )
    }
  
  isPrime( prime )
    {
      const n = 2*prime

      nextPrime:
      for (let i = 2; i <= n; i++) { // for each i...

        if ( i > prime )
          return false

        for (let j = 2; j < i; j++) { // look for a divisor..
          if (i % j === 0) continue nextPrime; // not a prime, go next i
        }

        // a prime
        if ( i === prime )
          return true
      }
    }
  
  nextPrime( prime )
    {
      const n = 2*prime
      let sawPrevious = false

      nextPrime:
      for (let i = 2; i <= n; i++) { // for each i...

        for (let j = 2; j < i; j++) { // look for a divisor..
          if (i % j === 0) continue nextPrime; // not a prime, go next i
        }

        // a prime
        if ( sawPrevious )
          return i
        if ( i === prime )
          sawPrevious = true
      }
    }
}
JavaAlgebraicNumberFactory.__interfaces = [ "com.vzome.core.algebra.AlgebraicNumberFactory" ]
export const algebraicNumberFactory = new JavaAlgebraicNumberFactory();

class JavaAlgebraicNumber
{
  constructor( legacyField, bigRationals )
  {
    this.legacyField = legacyField
    this.bigRationals = bigRationals
    this[ 'times$com_vzome_core_algebra_AlgebraicNumber' ] = this.times
    this[ 'plus$com_vzome_core_algebra_AlgebraicNumber' ] = this.plus
    this[ 'minus$com_vzome_core_algebra_AlgebraicNumber' ] = this.minus
  }

  equals( that )
  {
    return this.bigRationals.reduce( (a,c,i) => a && c.equals( that.bigRationals[ i ]), true )
  }

  getField()
  {
    return this.legacyField
  }

  evaluate()
  {
    return this.legacyField.evaluateNumber( this.bigRationals )
  }

  compareTo( that )
  {
    const d1 = this.evaluate();
    const d2 = that.evaluate();
    return (d1===d2)? 0 : (d1<d2) ? -1 : 1;
  }

  lessThan( that )
  {
    return this.compareTo(that) < 0;
  }

  greaterThan( that )
  {
    return this.compareTo(that) > 0;
  }

  lessThanOrEqualTo( that )
  {
    return this.compareTo(that) <= 0;
  }

  greaterThanOrEqualTo( that )
  {
    return this.compareTo(that) >= 0;
  }

  signum()
  {
    const d1 = this.evaluate();
    return (d1===0) ? 0 : (d1<0) ? -1 : 1;
  }
  
  isZero()
  {
    return this.bigRationals.reduce( ( a, c ) => a && c.isZero(), true )
  }

  isOne()
  {
    return this.bigRationals[ 0 ].isOne() && this.bigRationals.slice( 1 ).reduce( ( a, c ) => a && c.isZero(), true )
  }

  toTrailingDivisor()
  {
    const pairs = this.bigRationals.reduce( ( a, current ) => a.concat( [ current.getNumerator(), current.getDenominator() ] ), [] )
    return createNumberFromPairs( pairs )
  }

  negate()
  {
    return new JavaAlgebraicNumber( this.legacyField, this.bigRationals.map( br => br.negate() ) )
  }

  reciprocal()
  {
    return new JavaAlgebraicNumber( this.legacyField, this.legacyField.reciprocal( this.bigRationals ) )
  }
  
  minus( that )
  {
    return this.plus( that.negate() )
  }

  plus( that )
  {
    if (this.isZero()) {
      return that
    }
    if (that.isZero()) {
      return this
    }
    const sums = this.bigRationals.map( (v,i) => v.plus( that.bigRationals[ i ] ) )
    return new JavaAlgebraicNumber( this.legacyField, sums )
  }

  times( that )
  {
    if ( this.isZero() || that.isZero() )
        return this.legacyField.zero();
    if ( this.isOne() )
        return that;
    if ( that.isOne() )
        return this;
    const pairs = this.legacyField.multiply( this.bigRationals, that.bigRationals );
    return new JavaAlgebraicNumber( this.legacyField, pairs )
  }

  dividedBy( that )
  {
    return this.times( that.reciprocal() )
  }

  getNumberExpression( sbuf, format )
  {
    return this.legacyField.getNumberExpression( sbuf, this.bigRationals, format )
  }

  toString( format )
  {
    const buf = new java.lang.StringBuffer();
    this.getNumberExpression( buf, format );
    return buf .toString();
  }
}
JavaAlgebraicNumber.__interfaces = [ "com.vzome.core.algebra.AlgebraicNumber" ]

class JavaBigRational
{
  constructor( num, denom )
  {
    [ num, denom ] = simplify( [ BigInt(num), BigInt(denom) ] )
    this.num = num
    this.denom = denom
  }

  equals( that )
  {
    return this.num === that.num && this.denom === that.denom
  }

  toString()
  {
    if ( this.denom === 1n )
      return this.num.toString()
    else
      return this.num.toString() + "/" + this.denom.toString()
  }

  evaluate()
  {
    return Number( this.num ) / Number( this.denom )
  }

  isZero()
  {
    return this.num === 0n
  }

  isOne()
  {
    return this.num === 1n && this.denom === 1n
  }

  isNegative()
  {
    return this.num < 0n
  }

  negate()
  {
    return new JavaBigRational( -this.num, this.denom )
  }

  reciprocal()
  {
    if ( this.isOne() )
      return this
    return new JavaBigRational( this.denom, this.num )
  }

  getNumerator()
  {
    return this.num
  }

  getDenominator()
  {
    return this.denom
  }

  plus( that )
  {
    if (this.isZero()) {
      return that
    }
    if (that.isZero()) {
      return this
    }
    if (this.denom === that.denom) {
      return new JavaBigRational( this.num + that.num, this.denom )
    }
    // different denominators
    const d = this.denom * that.denom
    return new JavaBigRational( this.num*that.denom + that.num*this.denom, d )
  }

  times( that )
  {
    if ( this.isOne() ) {
        return that;
    }
    if ( that.isOne() ) {
        return this;
    }
    if ( this.isZero() || that.isZero() ) {
      return ZERO
    }
    return new JavaBigRational( this.num*that.num, this.denom*that.denom )
  }

  timesInt( i )
  {
    if ( i === 1 )
      return this
    if ( i === 0 )
      return ZERO
    return new JavaBigRational( this.num * BigInt(i), this.denom )
  }
}

const ZERO = new JavaBigRational( 0n, 1n )

class JavaDomNodeList
{
  constructor( nodeList, owner=null )
  {
    this.nativeNodeList = nodeList
    this.document = owner || new JavaDomDocument();
  }

  getLength()
  {
    return this.nativeNodeList.length
  }

  item( i )
  {
    const node = this.nativeNodeList[ i ];
    if ( node.tagName )
      return new JavaDomElement( node, this.document )
    else
      return node
  }
}
JavaDomNodeList.__interfaces = [ "org.w3c.dom.NodeList" ]

function sortObj(obj) {
  return Object.keys(obj).sort().reduce(function (result, key) {
    result[key] = obj[key];
    return result;
  }, {});
}

// JavaDomAttributes, JavaDomDocument, and the setters on JavaDomElement
//  are all required just for the edit .getDetailXml() function we need when
//  doing checkSideEffects() during debugging.
//
// The sorting in JavaDomAttributes is required to match the sorting behavior
//  that happens while serializing XML in the desktop implementation, since
//  checkSideEffects() completely bypasses XML serialization and parsing.

export class JavaDomAttributes
{
  toJSON( key )
  {
    return sortObj( this );
  }
}

export class JavaDomDocument
{
  constructor()
  {
  }

  createElement( tagName )
  {
    return new JavaDomElement( { tagName, attributes: new JavaDomAttributes(), children: [] }, this );
  }

  createTextNode( text )
  {
    return text;
  }
}
JavaDomDocument.__interfaces = [ "org.w3c.dom.Document" ]

export class JavaDomElement
{
  constructor( element, owner=null )
  {
    this.nativeElement = element
    this.document = owner || new JavaDomDocument();
  }

  appendChild( child )
  {
    if ( typeof( child ) === 'string' )
      this.nativeElement.children.push( child );
    else
      this.nativeElement.children.push( child.nativeElement );
  }

  setAttribute( name, value )
  {
    this.nativeElement.attributes[ name ] = value;
  }

  getOwnerDocument()
  {
    return this.document;
  }

  getAttribute( name )
  {
    return this.nativeElement.attributes[ name ];
  }

  getLocalName()
  {
    return this.nativeElement.tagName
  }

  getTextContent()
  {
    const kids = this.nativeElement.children .filter( kid => kid.tagName !== 'effects' ); // 'effects' appear when parsing a history export
    if ( kids.length === 1 && ( typeof kids[ 0 ] === 'string' ) )
      return kids[ 0 ];
    return null;
  }

  getChildNodes()
  {
    const kids = this.nativeElement.children .filter( kid => kid.tagName !== 'effects' ); // 'effects' appear when parsing a history export
    if ( kids.length === 1 && ( typeof kids[ 0 ] === 'string' ) )
      return null;
    return new JavaDomNodeList( kids, this.document )
  }

  getChildElement( name )
  {
    const nativeChild = this.nativeElement.children.filter( n => n.tagName === name )[ 0 ];
    return nativeChild && new JavaDomElement( nativeChild, this.document );
  }

  getElementsByTagName( name )
  {
    const results = this.nativeElement.children.filter( n => n.tagName === name );
    return {
      getLength: () => results.length,
      item: i => (i < results.length)? new JavaDomElement( results[ i ], this.document ) : null
    }
  }
}
JavaDomElement.__interfaces = [ "org.w3c.dom.Element" ]

export class JsProperties
{
  constructor( config )
  {
    this.config = config
  }

  getProperty( key )
  {
    return this.config[ key ]
  }

  get( key )
  {
    return this.config[ key ]
  }
}
