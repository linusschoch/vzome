package com.vzome.core.construction;

import org.w3c.dom.Document;
import org.w3c.dom.Element;

import com.vzome.core.algebra.AlgebraicField;
import com.vzome.core.algebra.RationalVectors;


/**
 * @author Scott Vorthmann
 */
public abstract class Point extends Construction
{
    private int[] /*AlgebraicVector*/ mLocation;

    protected Point( AlgebraicField field )
    {
        super( field );
    }
    
    protected boolean setStateVariable( int[] /*AlgebraicVector*/ loc, boolean impossible )
    {
        if ( impossible ) {
            // don't attempt to access other params
            if ( isImpossible() )
                return false;
            setImpossible( true );
            return true;
        }
        if ( loc .equals( mLocation )
        && ! isImpossible() )
            return false;
        mLocation = loc;
        setImpossible( false );
        return true;
    }
    
    public int[] /*AlgebraicVector*/ getLocation()
    {
        return mLocation;
    }

    public void accept( Visitor v )
    {
        v .visitPoint( this );
    }

    
    public Element getXml( Document doc )
    {
        Element result = doc .createElement( "point" );
        result .setAttribute( "at", RationalVectors .toString( getLocation() ) );
        return result;
    }

}