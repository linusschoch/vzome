/*
 * Created on May 4, 2003
 *
 * To change the template for this generated file go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
package com.vzome.core.parts;

import java.io.InputStream;

import com.vzome.core.algebra.AlgebraicField;
import com.vzome.core.math.Polyhedron;
import com.vzome.core.math.symmetry.Axis;
import com.vzome.core.math.symmetry.Direction;
import com.vzome.core.math.symmetry.IcosahedralSymmetry;
import com.vzome.core.math.symmetry.Permutation;
import com.vzome.core.math.symmetry.Symmetry;
import com.vzome.core.zomic.ZomicNamingConvention;
import com.vzome.core.zomic.parser.Parser;
import com.vzome.core.zomic.program.Anything;

public class ZomicStrutGeometry implements StrutGeometry
{
    public static final String SCRIPT_PREFIX = "com/vzome/core/parts/";

    private static final String SCRIPT_SUFFIX = "Strut.zomic";

    private static final String SHORT_SCRIPT_SUFFIX = "StrutShort.zomic";

    private final Permutation mAxisOrientation;

    private final int mHandedness;

    private final double mNoStrutSize, mNormalStrutSize;

    private final Anything mStrutProgram, mShortStrutProgram;

    private final Symmetry mSymmetry;

    public ZomicStrutGeometry( String geom, Direction dir,
            int[] /*AlgebraicNumber*/ noStrutSize, int[] /*AlgebraicNumber*/ normalStrutSize, Symmetry symmetry )
            throws IllegalStateException
    {
        mSymmetry = symmetry;
        AlgebraicField field = mSymmetry .getField();
        mNoStrutSize = field .evaluateNumber( noStrutSize );
        mNormalStrutSize = field .evaluateNumber( normalStrutSize );
        ZomicNamingConvention convention = new ZomicNamingConvention( (IcosahedralSymmetry) symmetry );

        Axis prototype = convention .getAxis( dir .getName(), "+0" );
        if ( prototype == null )
        {
        	mAxisOrientation = null;
        	mHandedness = 0;
        	mStrutProgram = null;
            mShortStrutProgram = null;
        	return;
        }
        int zeroOrientation = prototype.getOrientation();
        mAxisOrientation = mSymmetry .getPermutation( mSymmetry .inverse( zeroOrientation ) );
        mHandedness = prototype.getSense();        

        String script = SCRIPT_PREFIX;
        if ( geom.length() > 0 )
            script += geom + "/";
        script += dir .getName();
        InputStream nodeScript = getClass().getClassLoader()
                .getResourceAsStream( script + SCRIPT_SUFFIX );
        if ( nodeScript == null )
        {
        	mStrutProgram = null;
            mShortStrutProgram = null;
        	return;
        }

        mStrutProgram = Parser.parse( nodeScript, (IcosahedralSymmetry) symmetry );
        
        nodeScript = getClass().getClassLoader().getResourceAsStream(
                script + SHORT_SCRIPT_SUFFIX );
        if ( nodeScript == null )
            mShortStrutProgram = mStrutProgram;
        else
            mShortStrutProgram = Parser.parse( nodeScript, (IcosahedralSymmetry) symmetry );
    }
    
    public boolean isDefined()
    {
    	return mStrutProgram != null;
    }

    public ZomicStrutGeometry( String geom, Direction dir, Symmetry symmetry )
            throws IllegalStateException
    {
        this( geom, dir, symmetry .getField() .createPower( 0 ), symmetry .getField() .createPower( 1 ), symmetry );
    }

    public Polyhedron getStrutPolyhedron( int[] /*AlgebraicNumber*/ length )
    {
        AlgebraicField field = mSymmetry .getField();
        double len = field .evaluateNumber( length );
        if ( len < mNoStrutSize )
            return null;
        Anything program = len < mNormalStrutSize ? mShortStrutProgram : mStrutProgram;
        
        if ( program == null )
        	return null;

        ZomicPolyhedronModelInterpreter zpmi = new ZomicPolyhedronModelInterpreter(
                mSymmetry, program, length, mAxisOrientation, mHandedness );
        return zpmi.getPolyhedron();
    }

}
