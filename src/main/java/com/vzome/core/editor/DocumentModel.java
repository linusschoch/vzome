
//(c) Copyright 2011, Scott Vorthmann.

package com.vzome.core.editor;

import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.io.StringWriter;
import java.text.DecimalFormat;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Properties;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import com.vzome.core.algebra.AlgebraicField;
import com.vzome.core.algebra.PentagonField;
import com.vzome.core.commands.AbstractCommand;
import com.vzome.core.commands.Command;
import com.vzome.core.commands.XmlSaveFormat;
import com.vzome.core.commands.Command.Failure;
import com.vzome.core.construction.Construction;
import com.vzome.core.construction.FreePoint;
import com.vzome.core.construction.ModelRoot;
import com.vzome.core.construction.Point;
import com.vzome.core.construction.Polygon;
import com.vzome.core.construction.Segment;
import com.vzome.core.construction.SegmentCrossProduct;
import com.vzome.core.construction.SegmentJoiningPoints;
import com.vzome.core.editor.Snapshot.SnapshotAction;
import com.vzome.core.exporters.DaeExporter;
import com.vzome.core.exporters.DxfExporter;
import com.vzome.core.exporters.Exporter3d;
import com.vzome.core.exporters.LiveGraphicsExporter;
import com.vzome.core.exporters.OffExporter;
import com.vzome.core.exporters.OpenGLExporter;
import com.vzome.core.exporters.POVRayExporter;
import com.vzome.core.exporters.PartGeometryExporter;
import com.vzome.core.exporters.PartsListExporter;
import com.vzome.core.exporters.PdbExporter;
import com.vzome.core.exporters.RulerExporter;
import com.vzome.core.exporters.STEPExporter;
import com.vzome.core.exporters.SecondLifeExporter;
import com.vzome.core.exporters.SegExporter;
import com.vzome.core.exporters.StlExporter;
import com.vzome.core.exporters.VRMLExporter;
import com.vzome.core.exporters.VefExporter;
import com.vzome.core.exporters.Web3dExporter;
import com.vzome.core.math.DomUtils;
import com.vzome.core.math.Projection;
import com.vzome.core.math.RealVector;
import com.vzome.core.math.symmetry.Axis;
import com.vzome.core.math.symmetry.Direction;
import com.vzome.core.math.symmetry.OrbitSet;
import com.vzome.core.math.symmetry.QuaternionicSymmetry;
import com.vzome.core.math.symmetry.Symmetry;
import com.vzome.core.model.Connector;
import com.vzome.core.model.Exporter;
import com.vzome.core.model.Manifestation;
import com.vzome.core.model.ManifestationChanges;
import com.vzome.core.model.RealizedModel;
import com.vzome.core.model.Strut;
import com.vzome.core.model.VefModelExporter;
import com.vzome.core.render.Color;
import com.vzome.core.render.Colors;
import com.vzome.core.render.RenderedModel;
import com.vzome.core.viewing.Lights;
import com.vzome.core.viewing.ViewModel;

public class DocumentModel implements Snapshot .Recorder, UndoableEdit .Context, Tool .Registry
{
	private final ModelRoot mDerivationModel;

	private final RealizedModel mRealizedModel;

	private final Point originPoint;

	private final Selection mSelection;

	private final EditorModel mEditorModel;
	
	private final SymmetrySystem symmetrySystem;

    private final EditHistory mHistory;
    
    private final LessonModel lesson = new LessonModel();
    
	private final AlgebraicField mField;
	
	private final Map tools = new HashMap();
	
	private Command.FailureChannel failures;

	private boolean mEdited = false;

	private final Element mXML;
	
	private RenderedModel renderedModel;

    static Logger logger = Logger .getLogger( "com.vzome.core.editor" );

    // 2013-05-26
    //  I thought about leaving these two in EditorModel, but reconsidered.  Although they are in-memory
    //  state only, not saved in the file, they are still necessary for non-interactive use such as lesson export.
    
    private RenderedModel[] snapshots = new RenderedModel[8];
    
    private int numSnapshots = 0;

    private PropertyChangeSupport propertyChangeSupport = new PropertyChangeSupport( this );

	private final Map commands;

    private Map symmetrySystems = new HashMap();

    public void addPropertyChangeListener( PropertyChangeListener listener )
    {
    	propertyChangeSupport .addPropertyChangeListener( listener );
    }

    public void removePropertyChangeListener( PropertyChangeListener listener )
    {
    	propertyChangeSupport .removePropertyChangeListener( listener );
    }

    protected void firePropertyChange( String propertyName, Object oldValue, Object newValue )
    {
    	propertyChangeSupport .firePropertyChange( propertyName, oldValue, newValue );
    }

    protected void firePropertyChange( String propertyName, int oldValue, int newValue )
    {
    	propertyChangeSupport .firePropertyChange( propertyName, oldValue, newValue );
    }

	public DocumentModel( final AlgebraicField field, Command.FailureChannel failures, Element xml, final Application app )
	{
		super();

		this .mField = field;
		this .mDerivationModel = new ModelRoot( field );
		int[] /* AlgebraicVector */ origin = field .origin( 3 );
		this .originPoint = new FreePoint( origin, this .mDerivationModel );
		this .failures = failures;
		this .mXML = xml;
		this .commands = app .getCommands();

		this .mRealizedModel = new RealizedModel( new Projection.Default( field ) );

        Symmetry[] symms = field .getSymmetries();
        for ( int i = 0; i < symms .length; i++ ) {
            SymmetrySystem osm = new SymmetrySystem( null, symms[i], app .getColors(), app .getGeometries( symms[i] ), true );
            // one of these will be overwritten below, if we are loading from a file that has it set
            this .symmetrySystems .put( symms[i] .getName(), osm );
        }

		if ( xml != null ) {
	        NodeList nl = xml .getElementsByTagName( "SymmetrySystem" );
	        if ( nl .getLength() != 0 )
	            xml = (Element) nl .item( 0 );
	        else
	            xml = null;
		}
        String symmName = ( xml != null )? xml .getAttribute( "name" ) : symms[ 0 ] .getName();

        Symmetry symmetry = field .getSymmetry( symmName );
        this .symmetrySystem = new SymmetrySystem( xml, symmetry, app .getColors(), app .getGeometries( symmetry ), true );
        this .symmetrySystems .put( symmName, this .symmetrySystem );

        this .renderedModel = new RenderedModel( field, this .symmetrySystem .getRenderingStyle(), this .symmetrySystem );

		this .mRealizedModel .addListener( this .renderedModel ); // just setting the default
		
		this .mSelection = new Selection();
		// the renderedModel must either be disabled, or have shapes here, so the origin ball gets rendered
		this .mEditorModel = new EditorModel( this .mRealizedModel, this .mSelection, /*oldGroups*/ false, originPoint );

        mHistory = new EditHistory();
        mHistory .setListener( new EditHistory.Listener() {
			
			@Override
			public void showCommand( Element xml, int editNumber )
			{
				String str = editNumber + ": " + DomUtils .toString( xml );
				DocumentModel.this .firePropertyChange( "current.edit.xml", null, str );
			}
		});

        lesson .addPropertyChangeListener( new PropertyChangeListener()
        {
			public void propertyChange( PropertyChangeEvent change )
			{
				if ( "currentSnapshot" .equals( change .getPropertyName() ) )
				{
					int id = ((Integer) change .getNewValue()) .intValue();
	                RenderedModel newSnapshot = (RenderedModel) snapshots[ id ];
	                firePropertyChange( "currentSnapshot", null, newSnapshot );
				}
				else if ( "currentView" .equals( change .getPropertyName() ) )
				{
				    // forward to doc listeners
                    firePropertyChange( "currentView", change .getOldValue(), change .getNewValue() );
				}
				else if ( "thumbnailChanged" .equals( change .getPropertyName() ) )
				{
				    // forward to doc listeners
                    firePropertyChange( "thumbnailChanged", change .getOldValue(), change .getNewValue() );
				}
			}
		} );
	}
		
	public boolean isEdited()
	{
		return this .mEdited;
	}
	
	public void setRenderedModel( RenderedModel renderedModel )
	{
		this .mRealizedModel .removeListener( this .renderedModel );
		this .renderedModel = renderedModel;
		this .mRealizedModel .addListener( renderedModel );
		
		// "re-render" the origin
        Manifestation m = this .mRealizedModel .findConstruction( originPoint );
		m .setRenderedObject( null );
		this .mRealizedModel .show( m );
	}

	public UndoableEdit createEdit( String name, XmlSaveFormat format )
	{
		UndoableEdit edit = null;
		boolean groupInSelection = format .groupingDoneInSelection(); // loading pre-2.1.2

		if ( "Snapshot" .equals( name ) )
			edit = new Snapshot( -1, this );

		else if ( "Branch" .equals( name ) )
			edit = new Branch();

		else if ( "ShowPoint".equals( name ) )
			edit = new ShowPoint( null, this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "setItemColor".equals( name ) )
			edit = new ColorManifestations( this.mSelection, this.mRealizedModel, null, groupInSelection );

		else if ( "ShowHidden".equals( name ) )
			edit = new ShowHidden( this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "CrossProduct".equals( name ) )
			edit = new CrossProduct( this.mSelection, this.mRealizedModel, this.mDerivationModel, groupInSelection );

		else if ( "AffinePentagon".equals( name ) )
			edit = new AffinePentagon( this.mSelection, this.mRealizedModel, this.mDerivationModel, groupInSelection );

		else if ( "AffineTransformAll".equals( name ) )
			edit = new AffineTransformAll( this.mSelection, this.mRealizedModel, this.mEditorModel.getCenterPoint(), groupInSelection );

		else if ( "HeptagonSubdivision".equals( name ) )
			edit = new HeptagonSubdivision( this.mSelection, this.mRealizedModel, this.mDerivationModel, groupInSelection );

		else if ( "DodecagonSymmetry".equals( name ) )
			edit = new DodecagonSymmetry( this.mSelection, this.mRealizedModel, this.mEditorModel.getCenterPoint(), groupInSelection );

		else if ( "GhostSymmetry24Cell".equals( name ) )
			edit = new GhostSymmetry24Cell( this.mSelection, this.mRealizedModel, this.mDerivationModel, this.mEditorModel.getSymmetrySegment(),
					groupInSelection );

		else if ( "StrutCreation".equals( name ) )
			edit = new StrutCreation( null, null, null, this.mRealizedModel );

		else if ( "BnPolyope".equals( name ) || "B4Polytope".equals( name ) )
			edit = new B4Polytope( this.mSelection, this.mRealizedModel, this.mDerivationModel, null, 0, groupInSelection );

		else if ( "Polytope4d".equals( name ) )
			edit = new Polytope4d( this.mSelection, this.mRealizedModel, this.mDerivationModel, null, 0, null, groupInSelection );

		else if ( "LoadVEF".equals( name ) )
			edit = new LoadVEF( this.mSelection, this.mRealizedModel, null, null, null, this.mDerivationModel );

		else if ( "GroupSelection".equals( name ) )
			edit = new GroupSelection( this.mSelection, false );

		else if ( "BeginBlock".equals( name ) )
			edit = new BeginBlock();

		else if ( "EndBlock".equals( name ) )
			edit = new EndBlock();

		else if ( "InvertSelection".equals( name ) )
			edit = new InvertSelection( this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "JoinPoints".equals( name ) )
			edit = new JoinPoints( this.mSelection, this.mRealizedModel, groupInSelection, true );

		else if ( "NewCentroid" .equals( name ) )
			edit = new Centroid( this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "StrutIntersection".equals( name ) )
			edit = new StrutIntersection( this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "LinePlaneIntersect".equals( name ) )
			edit = new LinePlaneIntersect( this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "SelectAll".equals( name ) )
			edit = new SelectAll( this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "DeselectAll".equals( name ) )
			edit = new DeselectAll( this.mSelection, groupInSelection );

		else if ( "DeselectByClass".equals( name ) )
			edit = new DeselectByClass( this.mSelection, false );

		else if ( "SelectManifestation".equals( name ) )
			edit = new SelectManifestation( null, false, this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "SelectNeighbors".equals( name ) )
			edit = new SelectNeighbors( this.mSelection, this.mRealizedModel, groupInSelection );

		else if ( "SelectSimilarSize".equals( name ) )
			edit = new SelectSimilarSizeStruts( null, null, this .mSelection, this .mRealizedModel, this .mField );

		else if ( "ValidateSelection".equals( name ) )
			edit = new ValidateSelection( this.mSelection );

		else if ( "SymmetryCenterChange".equals( name ) )
			edit = new SymmetryCenterChange( this.mEditorModel, null );

		else if ( "SymmetryAxisChange".equals( name ) )
			edit = new SymmetryAxisChange( this.mEditorModel, null );

		else if ( "RunZomicScript".equals( name ) )
			edit = new RunZomicScript( this.mSelection, this.mRealizedModel, null, mEditorModel.getCenterPoint() );

		else if ( "RunPythonScript".equals( name ) )
			edit = new RunPythonScript( this.mSelection, this.mRealizedModel, null, mEditorModel.getCenterPoint(), this .mDerivationModel );

		else if ( "BookmarkTool".equals( name ) )
			edit = new BookmarkTool( name, this.mSelection, this.mRealizedModel, mDerivationModel, this );

		else if ( "ModuleTool" .equals( name ) )
			edit = new ModuleTool( null, mSelection, mRealizedModel, mDerivationModel, this );

		else if ( "PlaneSelectionTool" .equals( name ) )
			edit = new PlaneSelectionTool( null, mSelection, mField, this );

		else if ( "SymmetryTool".equals( name ) )
			edit = new SymmetryTool( null, null, this.mSelection, this.mRealizedModel, this, this.originPoint );

		else if ( "ScalingTool".equals( name ) )
			edit = new ScalingTool( name, null, this.mSelection, this.mRealizedModel, this, this.originPoint );

		else if ( "RotationTool".equals( name ) )
			edit = new RotationTool( name, null, this.mSelection, this.mRealizedModel, this, this.originPoint );

		else if ( "InversionTool".equals( name ) )
			edit = new InversionTool( name, this.mSelection, this.mRealizedModel, this, this.originPoint );

		else if ( "MirrorTool".equals( name ) )
			edit = new MirrorTool( name, this.mDerivationModel, this.mSelection, this.mRealizedModel, this, this.originPoint );

		else if ( "TranslationTool".equals( name ) )
			edit = new TranslationTool( name, this.mSelection, this.mRealizedModel, this, this.originPoint, this.mDerivationModel );

		else if ( "LinearMapTool".equals( name ) )
			edit = new LinearMapTool( name, this.mSelection, this.mRealizedModel, this, this.originPoint, true );

		else if ( "LinearTransformTool".equals( name ) )
			edit = new LinearMapTool( name, this.mSelection, this.mRealizedModel, this, this.originPoint, false );

		else if ( "ToolApplied".equals( name ) )
			edit = new ApplyTool( this.mSelection, this.mRealizedModel, this, false );

		else if ( "ApplyTool".equals( name ) )
			edit = new ApplyTool( this.mSelection, this.mRealizedModel, this, true );

		if ( edit == null )
			// any command unknown (i.e. from a newer version of vZome) becomes a CommandEdit
			edit = new CommandEdit( null, mEditorModel, mDerivationModel, groupInSelection );

		edit .setContext( this );
		
		return edit;
	}
	
	public String copySelectionVEF()
	{
		StringWriter out = new StringWriter();
		Exporter exporter = new VefModelExporter( out, mField, null );
		for (Iterator mans = mSelection .iterator(); mans .hasNext(); ) {
			Manifestation man = (Manifestation) mans .next();
			exporter .exportManifestation( man );
		}
		exporter .finish();
		return out .toString();
	}

	public void pasteVEF( String vefContent )
	{
        UndoableEdit edit = new LoadVEF( this.mSelection, this.mRealizedModel, vefContent, null, null, this.mDerivationModel );
        performAndRecord( edit );
	}

	public void applyTool( Tool tool, Tool.Registry registry, int modes )
	{
		UndoableEdit edit = new ApplyTool( this.mSelection, this.mRealizedModel, tool, registry, modes, true );
        performAndRecord( edit );
	}

    public UndoableEdit createEdit( String action )
    {
    	// TODO break all these cases out as dedicated DocumentModel methods

    	Command command = (Command) commands .get( action );
    	if ( command != null )
    	{
    	    return new CommandEdit( (AbstractCommand) command, mEditorModel, mDerivationModel, false );
    	}
    	
        UndoableEdit edit = null;
        if ( action.equals( "selectAll" ) )
            edit = mEditorModel.selectAll();
        else if ( action.equals( "unselectAll" ) )
            edit = mEditorModel.unselectAll();
        else if ( action.equals( "unselectBalls" ) )
            edit = mEditorModel.unselectConnectors();
        else if ( action.equals( "unselectStruts" ) )
            edit = mEditorModel.unselectStruts();
        else if ( action.equals( "selectNeighbors" ) )
            edit = mEditorModel.selectNeighbors();
        else if ( action.equals( "invertSelection" ) )
            edit = mEditorModel.invertSelection();
        else if ( action.equals( "group" ) )
            edit = mEditorModel.groupSelection();
        else if ( action.equals( "ungroup" ) )
            edit = mEditorModel.ungroupSelection();

        else if ( action.equals( "assertSelection" ) )
            edit = new ValidateSelection( mSelection );

//        else if ( action.equals( "sixLattice" ) )
//            edit = new SixLattice( mSelection, mRealizedModel, mDerivationModel );

        // not supported currently, so I don't have to deal with the mTargetManifestation problem
//        else if ( action .equals( "reversePanel" ) )
//            edit = new ReversePanel( mTargetManifestation, mSelection, mRealizedModel, mDerivationModel );
        else if ( action.equals( "createStrut" ) )
            edit = new StrutCreation( null, null, null, mRealizedModel );
        else if ( action.startsWith( "setItemColor/" ) )
        {
            String value = action .substring( "setItemColor/" .length() );
            int rgb = Integer .parseInt( value, 16 );
            edit = new ColorManifestations( mSelection, mRealizedModel, new Color( rgb ), false );
        }
        else if ( action.equals( "joinballs" ) )
            edit = new JoinPoints( mSelection, mRealizedModel, false, true );
        else if ( action.equals( "chainBalls" ) )
            edit = new JoinPoints( mSelection, mRealizedModel, false, false );
        else if ( action.equals( "ballAtOrigin" ) )
            edit = new ShowPoint( originPoint, mSelection, mRealizedModel, false );
        else if ( action.equals( "ballAtSymmCenter" ) )
            edit = new ShowPoint( mEditorModel.getCenterPoint(), mSelection, mRealizedModel, false );
        else if ( action.equals( "linePlaneIntersect" ) )
            edit = new LinePlaneIntersect( mSelection, mRealizedModel, false );
        else if ( action.equals( "lineLineIntersect" ) )
            edit = new StrutIntersection( mSelection, mRealizedModel, false );
        else if ( action.equals( "heptagonDivide" ) )
            edit = new HeptagonSubdivision( mSelection, mRealizedModel, mDerivationModel, false );
        else if ( action.equals( "crossProduct" ) )
            edit = new CrossProduct( mSelection, mRealizedModel, mDerivationModel, false );
        else if ( action.equals( "centroid" ) )
            edit = new Centroid( mSelection, mRealizedModel, false );
        else if ( action.equals( "showHidden" ) )
            edit = new ShowHidden( mSelection, mRealizedModel, false );
        else if ( action.equals( "affinePentagon" ) )
            edit = new AffinePentagon( mSelection, mRealizedModel, mDerivationModel, false );
        else if ( action.equals( "affineTransformAll" ) )
        	edit = new AffineTransformAll( mSelection, mRealizedModel, mEditorModel.getCenterPoint(), false );
        else if ( action.equals( "setCustomOperatorParameters" ) )
            edit = new DefineTransformation( mSelection, mEditorModel, false );
        else if ( action.equals( "runCustomOperator" ) )
            edit = new TransformSelection( mSelection, mRealizedModel, mEditorModel.getTransformation() );
        else if ( action.equals( "dodecagonsymm" ) )
            edit = new DodecagonSymmetry( mSelection, mRealizedModel, mEditorModel.getCenterPoint(), false );
        else if ( action.equals( "ghostsymm24cell" ) )
            edit = new GhostSymmetry24Cell( mSelection, mRealizedModel, mDerivationModel, mEditorModel.getSymmetrySegment(), false );
		else if ( action.equals( "apiProxy" ) )
			edit = new ApiEdit( this .mSelection, this .mRealizedModel, this .originPoint, this .mDerivationModel );

		else if ( action.startsWith( "polytope_" ) )
        {
            int beginIndex = "polytope_".length();
            String group = action.substring( beginIndex, beginIndex + 2 );
            String suffix = action.substring( beginIndex + 2 );
            System.out.println( "computing " + group + " " + suffix );
            int index = Integer.parseInt( suffix, 2 );
            edit = new Polytope4d( mSelection, mRealizedModel, mDerivationModel, mEditorModel.getSymmetrySegment(),
                    index, group, false );
        }

        if ( edit == null )
        {
        	logger .warning( "no DocumentModel action for : " + action );
        }
        return edit;
    }

	public void performAndRecord( UndoableEdit edit )
	{
        if ( edit == null )
            return;
        if ( edit instanceof NoOp )
        	return;

        try {
            synchronized ( this .mHistory ) {
                edit .perform();
                this .mHistory .mergeSelectionChanges();
                this .mHistory .addEdit( edit );
            }
        }
        catch ( RuntimeException re )
        {
            Throwable cause = re.getCause();
            if ( cause instanceof Command.Failure )
            	this .failures .reportFailure( (Failure) cause );
            else if ( cause != null )
            	this .failures .reportFailure( new Failure( cause ) );
            else
            	this .failures .reportFailure( new Failure( re ) );
        }
        catch ( Failure failure )
        {
        	this .failures .reportFailure( failure );
        }
        this .mEdited  = true;
    }

	public void setParameter( Construction singleConstruction, String paramName ) throws Failure
	{
    	UndoableEdit edit = null;
    	if ( "ball" .equals( paramName ) )
    		edit = mEditorModel .setSymmetryCenter( singleConstruction );
    	else if ( "strut" .equals( paramName ) )
    		edit = mEditorModel .setSymmetryAxis( (Segment) singleConstruction );
    	if ( edit != null )
    		this .performAndRecord( edit );
	}
	
	public RealVector getLocation( Construction target )
	{
		if ( target instanceof Point)
			return mField .getRealVector( ( (Point) target ).getLocation() );
		else if ( target instanceof Segment )
			return mField .getRealVector( ( (Segment) target ).getStart() );
		else if ( target instanceof Polygon )
			return mField .getRealVector( ( (Polygon) target ).getVertices()[ 0 ] );
		else
			return new RealVector( 0, 0, 0 );
	}

	public RealVector getParamLocation( String string )
	{
		if ( "ball" .equals( string ) )
		{
	    	Point ball = mEditorModel .getCenterPoint();
	    	return mField.getRealVector( ( (Point) ball ).getLocation() );
		}
		return new RealVector( 0, 0, 0 );
	}

    public void selectSimilarStruts( Direction orbit, int[] length )
    {
        UndoableEdit edit = new SelectSimilarSizeStruts( orbit, length, mSelection, mRealizedModel, mField );
        this .performAndRecord( edit );
    }
    
    public void loadXml( boolean openUndone, boolean asTemplate ) throws Command.Failure
    {
    	if ( mXML == null )
    		return;

        // TODO: record the edition, version, and revision on the format, so we can report a nice
        //   error if we fail to understand some command in the history.  If the revision is
        //   greater than Version .SVN_REVISION:
        //    "This document was created using $file.edition $file.version, and contains commands that
        //      $Version.edition does not understand.  You may need a newer version of
        //      $Version.edition, or a copy of $file.edition $file.version."
        //   (Adjust that if $Version.edition == $file.edition, to avoid confusion.)

        String tns = mXML .getNamespaceURI();
        XmlSaveFormat format = XmlSaveFormat.getFormat( tns );
        if ( format == null )
            return; // already checked and reported version compatibility,
        // up in the constructor

        int scale = 0;
        String scaleStr = mXML .getAttribute( "scale" );
        if ( ! scaleStr .isEmpty() )
            scale = Integer.parseInt( scaleStr );
        OrbitSet.Field orbitSetField = new OrbitSet.Field()
        {
            public OrbitSet getGroup( String name )
            {
                SymmetrySystem system = (SymmetrySystem) symmetrySystems .get( name );
            	return system .getOrbits();
            }

            public QuaternionicSymmetry getQuaternionSet( String name )
            {
                return mField .getQuaternionSymmetry( name);
            }
        };
        format .initialize( mField, orbitSetField, scale, mXML .getAttribute( "version" ), new Properties() );

        Element hist = (Element) mXML .getElementsByTagName( "EditHistory" ) .item( 0 );
        if ( hist == null )
            hist = (Element) mXML .getElementsByTagName( "editHistory" ) .item( 0 );
        int editNum = Integer.parseInt( hist .getAttribute( "editNumber" ) );
        
        List implicitSnapshots = new ArrayList();

        // if we're opening a template document, we don't want to inherit its lesson or saved views
        if ( !asTemplate )
        {
        	Map viewPages = new HashMap();
        	ViewModel defaultView = new ViewModel();
            Element views = (Element) mXML .getElementsByTagName( "Viewing" ) .item( 0 );
            if ( views != null ) {
                // make a notes page for each saved view
                //  ("edited" property change will be fired, to trigger migration semantics)
            	// migrate saved views to notes pages
                NodeList nodes = views .getChildNodes();
                for ( int i = 0; i < nodes .getLength(); i++ ) {
                    Node node = nodes .item( i );
            		if ( node instanceof Element ) {
            			Element viewElem = (Element) node;
            			String name = viewElem .getAttribute( "name" );
            			ViewModel view = new ViewModel( viewElem );
            			if ( ( name == null || name .isEmpty() )
            		    || ( "default" .equals( name ) ) )
            			{
            				defaultView = view;
            			}
            			else
            				viewPages .put( name, view ); // named view to migrate to a lesson page
            		}
            	}
            }

            Element notesXml = (Element) mXML .getElementsByTagName( "notes" ) .item( 0 );
            if ( notesXml != null ) 
            	lesson .setXml( notesXml, editNum, defaultView );
            
            // add migrated views to the end of the lesson
            for (Iterator iterator = viewPages .entrySet() .iterator(); iterator.hasNext();) {
				Entry namedView = (Entry) iterator.next();
				lesson .addPage( (String) namedView .getKey(), "This page was a saved view created by an older version of vZome.", (ViewModel) namedView .getValue(), -editNum );
			}
            
            for (Iterator iterator = lesson .iterator(); iterator.hasNext(); ) {
            	PageModel page = (PageModel) iterator.next();
                int snapshot = page .getSnapshot();
                if ( ( snapshot < 0 ) && ( ! implicitSnapshots .contains( new Integer( -snapshot ) ) ) )
                	implicitSnapshots .add( new Integer( -snapshot ) );
            }

            Collections .sort( implicitSnapshots );
            
            for (Iterator iterator = lesson .iterator(); iterator.hasNext(); ) {
            	PageModel page = (PageModel) iterator.next();
                int snapshot = page .getSnapshot();
                if ( snapshot < 0 )
                    page .setSnapshot( implicitSnapshots .indexOf( new Integer( -snapshot ) ) );
            }
        }

        UndoableEdit[] explicitSnapshots = null;
        if ( ! implicitSnapshots .isEmpty() )
        {
            Integer highest = (Integer) implicitSnapshots .get( implicitSnapshots .size() - 1 );
            explicitSnapshots = new UndoableEdit[ highest .intValue() + 1 ];
            for (int i = 0; i < implicitSnapshots .size(); i++)
            {
                Integer editNumInt = (Integer) implicitSnapshots .get( i );
                explicitSnapshots[ editNumInt .intValue() ] = new Snapshot( i, this );
            }
        }
        
        try {
            int lastDoneEdit = openUndone? 0 : Integer.parseInt( hist .getAttribute( "editNumber" ) );
            String lseStr = hist .getAttribute( "lastStickyEdit" );
            int lastStickyEdit = ( ( lseStr == null ) || lseStr .isEmpty() )? -1 : Integer .parseInt( lseStr );
            NodeList nodes = hist .getChildNodes();
            for ( int i = 0; i < nodes .getLength(); i++ ) {
                Node kid = nodes .item( i );
                if ( kid instanceof Element ) {
                    Element editElem = (Element) kid;
                    mHistory .loadEdit( format, editElem, this );
                }
            }
            mHistory .synchronize( lastDoneEdit, lastStickyEdit, explicitSnapshots );
        } catch ( Throwable t )
        {
        	String message = format .getFormatError( mXML, Version.edition, Version.label, Version.SVN_REVISION );
        	throw new Failure( message, t );
        }

        mEdited = openUndone || mEdited || format.isMigration() || ! implicitSnapshots .isEmpty();
    }

    public Element getSaveXml( Document doc )
    {
        Element vZomeRoot = doc .createElementNS( XmlSaveFormat.CURRENT_FORMAT, "vzome:vZome" );
        vZomeRoot .setAttribute( "xmlns:vzome", XmlSaveFormat.CURRENT_FORMAT );
        vZomeRoot .setAttribute( "edition", Version.edition );
        vZomeRoot .setAttribute( "version", Version.label );
        vZomeRoot .setAttribute( "revision", Integer .toString( Version.SVN_REVISION ) );
        vZomeRoot .setAttribute( "field", mField.getName() );
        Element result;
        {
            result = mHistory .getXml( doc );
            int edits = 0, lastStickyEdit=-1;
            for ( Iterator it = mHistory .iterator(); it .hasNext(); )
            {
                UndoableEdit undoable = (UndoableEdit) it .next();
                result .appendChild( undoable .getXml( doc ) );
                ++ edits;
                if ( undoable .isSticky() )
                    lastStickyEdit = edits;
            }
            result .setAttribute( "lastStickyEdit", Integer .toString( lastStickyEdit ) );
        }
        vZomeRoot .appendChild( result );
        vZomeRoot .appendChild( lesson .getXml( doc ) );
        return vZomeRoot;
    }
    
    public void doScriptAction( String command, String script )
    {
    	UndoableEdit edit = null;
    	if ( command.equals( "runZomicScript" ) || command.equals( "zomic" ) )
    	{
    		edit = new RunZomicScript( mSelection, mRealizedModel, script, mEditorModel.getCenterPoint() );
    		this .performAndRecord( edit );
    	}
    	else if ( command.equals( "runPythonScript" ) || command.equals( "py" ) )
    	{
    		edit = new RunPythonScript( mSelection, mRealizedModel, script, mEditorModel.getCenterPoint(), this.mDerivationModel );
    		this .performAndRecord( edit );
    	}
    	//    else if ( command.equals( "import.zomod" ) )
    	//        edit = new RunZomodScript( mSelection, mRealizedModel, script, mEditorModel.getCenterPoint(), mField .getSymmetry( "icosahedral" ) );
    	else if ( command.equals( "import.vef" ) || command.equals( "vef" ) )
    	{
    		Segment symmAxis = mEditorModel .getSymmetrySegment();
    		int[] quat = ( symmAxis == null ) ? null : symmAxis.getOffset();
    		if ( quat != null )
    			quat = mField .scaleVector( quat, mField .createPower( - 5 ) );
    		int[] scale = mField .createPower( 5 );
    		edit = new LoadVEF( mSelection, mRealizedModel, script, quat, scale, mDerivationModel );
    		this .performAndRecord( edit );
    	}
    }

    public void addTool( Tool tool )
    {
    	String name = tool .getName();
    	tools .put( name, tool );
    }

    public void removeTool( Tool tool )
    {
    	String name = tool .getName();
    	tools .remove( name );
    }

    public Tool getTool( String toolName )
    {
    	return (Tool) tools .get( toolName );
    }

    public void useTool( Tool tool ) {}

    public AlgebraicField getField()
    {
    	return this .mField;
    }

	public void addSelectionListener( ManifestationChanges listener )
	{
		this .mSelection .addListener( listener );
	}

	public Element getLoadXml()
	{
		return this .mXML;
	}

	private static final NumberFormat FORMAT = NumberFormat .getNumberInstance( Locale .US );

	public String getManifestationProperties( Manifestation man, Symmetry symmetry )
	{
        if ( man instanceof Connector )
        {
            StringBuffer buf;
            int[] loc = ((Connector) man) .getLocation();

            System .out .println( mField .getVectorExpression( loc, AlgebraicField.EXPRESSION_FORMAT ) );
            System .out .println( mField .getVectorExpression( loc, AlgebraicField.ZOMIC_FORMAT ) );
            System .out .println( mField .getVectorExpression( loc, AlgebraicField.VEF_FORMAT ) );
            
            buf = new StringBuffer();
            buf .append( "location: " );
            mField .getVectorExpression( buf, loc, AlgebraicField.DEFAULT_FORMAT );
            return buf.toString();
        }
        else if ( man instanceof Strut ) {
            StringBuffer buf = new StringBuffer();
            buf.append( "start: " );
            mField.getVectorExpression( buf, ( (Strut) man ).getLocation(),
                    AlgebraicField.DEFAULT_FORMAT );
            buf.append( "\n\noffset: " );
            int[] /* AlgebraicVector */offset = ( (Strut) man ).getOffset();

            System .out .println( mField .getVectorExpression( offset, AlgebraicField.EXPRESSION_FORMAT ) );
            System .out .println( mField .getVectorExpression( offset, AlgebraicField.ZOMIC_FORMAT ) );
            System .out .println( mField .getVectorExpression( offset, AlgebraicField.VEF_FORMAT ) );
            
            mField.getVectorExpression( buf, offset, AlgebraicField.DEFAULT_FORMAT );
            buf.append( "\n\nnorm squared: " );
            int[] normSquared = mField.dot( offset, offset );
            double norm2d = mField .evaluateNumber( normSquared );
            mField.getNumberExpression( buf, normSquared, 0, AlgebraicField.DEFAULT_FORMAT );
            buf.append( " = " );
            buf.append( FORMAT.format( norm2d ) );

            if ( mField.isOrigin( offset ) )
                return "zero length!";
            Axis zone = symmetry .getAxis( offset );
            
            int[] /*AlgebraicNumber*/ len = zone .getLength( offset );
            len = zone .getOrbit() .getLengthInUnits( len );

            buf.append( "\n\nlength in orbit units: " );
            mField .getNumberExpression( buf, len, 0, AlgebraicField.DEFAULT_FORMAT );

            if ( mField instanceof PentagonField)
            {
                buf.append( "\n\nlength in Zome b1 struts: " );
                if (FORMAT instanceof DecimalFormat) {
                    ((DecimalFormat) FORMAT) .applyPattern( "0.0000" );
                }
                buf.append( FORMAT.format( Math.sqrt( norm2d ) / PentagonField.B1_LENGTH ) );
            }
            return buf .toString();
        }
        else
        	return "PANEL"; // TODO panels
    }

	public void undo()
	{
		mHistory .undo();
	}

	public void redo() throws Command.Failure
	{
		mHistory .redo();
	}

	public void undoToBreakpoint()
	{
		mHistory .undoToBreakpoint();
	}

	public void redoToBreakpoint() throws Command.Failure
	{
		mHistory .redoToBreakpoint();
	}

	public void setBreakpoint()
	{
		mHistory .setBreakpoint();
	}

	public void undoAll()
	{
		mHistory .undoAll();
	}

	public void redoAll( int i ) throws Command .Failure
	{
		mHistory .redoAll( i );
	}

    public UndoableEdit deselectAll()
    {
        return mEditorModel .unselectAll();
    }

    public UndoableEdit selectManifestation( Manifestation target, boolean replace )
    {
        return mEditorModel .selectManifestation( target, replace );
    }

    public UndoableEdit createStrut( Point point, Axis zone, int[] length )
    {
        return new StrutCreation( point, zone, length, this .mRealizedModel );
    }

	public void createTool( String name, String group, Tool.Registry tools, Symmetry symmetry )
	{
        Selection toolSelection = mSelection;

        if ( "default" .equals( group ) )
        {
            name = name .substring( "default." .length() );
            int nextDot = name .indexOf( "." );
            group = name .substring( 0, nextDot );
            toolSelection = new Selection();
        }
        
        UndoableEdit edit = null;
        if ( "bookmark" .equals( group ) )
            edit = new BookmarkTool( name, toolSelection, mRealizedModel, mDerivationModel, tools );
        else if ( "point reflection" .equals( group ) )
            edit = new InversionTool( name, toolSelection, mRealizedModel, tools, originPoint );
        else if ( "mirror" .equals( group ) )
            edit = new MirrorTool( name, mDerivationModel, toolSelection, mRealizedModel, tools, originPoint );
        else if ( "translation" .equals( group ) )
            edit = new TranslationTool( name, toolSelection, mRealizedModel, tools, originPoint, mDerivationModel );
        else if ( "linear map" .equals( group ) )
            edit = new LinearMapTool( name, toolSelection, mRealizedModel, tools, originPoint, false );
        else if ( "rotation" .equals( group ) )
            edit = new RotationTool( name, symmetry, mSelection, mRealizedModel, tools, originPoint );
        else if ( "scaling" .equals( group ) )
        	edit = new ScalingTool( name, symmetry, mSelection, mRealizedModel, tools, originPoint );
        else if ( "tetrahedral" .equals( group ) )
            edit = new SymmetryTool( name, symmetry, mSelection, mRealizedModel, tools, originPoint );
        else if ( "module" .equals( group ) )
            edit = new ModuleTool( name, mSelection, mRealizedModel, mDerivationModel, tools );
        else if ( "plane" .equals( group ) )
            edit = new PlaneSelectionTool( name, mSelection, mField, tools );
        else
        	edit = new SymmetryTool( name, symmetry, mSelection, mRealizedModel, tools, originPoint );
        
        performAndRecord( edit );
	}

	public Exporter3d getNaiveExporter( String format, ViewModel view, Colors colors, Lights lights, RenderedModel currentSnapshot )
	{
        if ( format.equals( "pov" ) )
            return new POVRayExporter( view, colors, lights, currentSnapshot );
        else if ( format.equals( "opengl" ) )
        	return new OpenGLExporter( view, colors, lights, currentSnapshot );
        else if ( format.equals( "dae" ) )
        	return new VRMLExporter( view, colors, lights, currentSnapshot );
        else
        	return null;
    }

	/*
	 * These exporters fall in two categories: rendering and geometry.  The ones that support the currentSnapshot
	 * (the current article page, or the main model) can do rendering export, and can work with just a rendered
	 * model (a snapshot), which has lost its attached Manifestation objects.
	 * 
	 * The ones that require mRenderedModel need access to the RealizedModel objects hanging from it (the
	 * Manifestations).  These are the geometry exporters.  They can be aware of the structure of field elements,
	 * as well as the orbits and zones.
	 * 
	 * POV-Ray is a bit of a special case, but only because the .pov language supports coordinate values as expressions,
	 * and supports enough modeling that the different strut shapes can be defined, and so on.
	 * It is likely that COLLADA DAE has the same character.  OpenGL and WebGL (Web3d/json) could as well, since I
	 * can control how the data is stored and rendered.
	 * 
	 * The POV-Ray export reuses shapes, etc. just as vZome does, so really works just with the RenderedManifestations
	 * (except when the Manifestation is available for structured coordinate expressions).  Again, any rendering exporter
	 * could apply the same reuse tricks, working just with RenderedManifestations, so the current limitations to
	 * mRenderedModel for many of these is spurious.
	 */   
	
	// TODO move all the parameters inside this object!
	
	public Exporter3d getStructuredExporter( String format, ViewModel view, Colors colors, Lights lights, RenderedModel mRenderedModel )
	{
        if ( format.equals( "LiveGraphics" ) )
        	return new DaeExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "json" ) )
        	return new Web3dExporter( lights .getBackgroundColor(), mRenderedModel );
        else if ( format.equals( "step" ) )
        	return new STEPExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "vrml" ) )
        	return new LiveGraphicsExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "off" ) )
        	return new OffExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "2life" ) )
        	return new SecondLifeExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "vef" ) )
        	return new VefExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "partgeom" ) )
        	return new PartGeometryExporter( view, colors, lights, mRenderedModel, mSelection );
        else if ( format.equals( "partslist" ) )
        	return new PartsListExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "size" ) )
        	return new RulerExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "stl" ) )
        	return new StlExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "dxf" ) )
        	return new DxfExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "pdb" ) )
        	return new PdbExporter( view, colors, lights, mRenderedModel );
        else if ( format.equals( "seg" ) )
        	return new SegExporter( view, colors, lights, mRenderedModel );
        else
        	return null;
	}

	public LessonModel getLesson()
	{
		return lesson;
	}

    public void recordSnapshot( int id )
    {
    	RenderedModel snapshot = ( renderedModel == null )? null : renderedModel .snapshot();
    	Logger logger = Logger.getLogger( "com.vzome.core.thumbnails" );
    	if ( logger .isLoggable( Level.FINER ) )
    		logger .finer( "recordSnapshot: " + id );
    	numSnapshots = Math .max( numSnapshots, id + 1 );
    	if ( id >= snapshots.length )
    	{
    		int newLength = Math .max( 2 * snapshots .length, numSnapshots );
    		snapshots = (RenderedModel[]) Arrays .copyOf( snapshots, newLength );
    	}
    	snapshots[ id ] = snapshot;
    }

	public void actOnSnapshot( int id, SnapshotAction action )
	{
        RenderedModel snapshot = (RenderedModel) snapshots[ id ];
        action .actOnSnapshot( snapshot );
	}

	public void addSnapshotPage( ViewModel view )
	{
        int id = numSnapshots;
        this .performAndRecord( new Snapshot( id, this ) );
        lesson .newSnapshotPage( id, view );
	}

	public RenderedModel getRenderedModel()
	{
		return this .renderedModel;
	}

    public void generatePolytope( String group, String renderGroup, int index, int edgesToRender, int[][] edgeScales )
    {
        UndoableEdit edit = new Polytope4d( mSelection, mRealizedModel, mDerivationModel, mEditorModel.getSymmetrySegment(), index, group, edgesToRender, edgeScales, renderGroup );
        this .performAndRecord( edit );
    }
    
    public Segment getSymmetryAxis()
    {
    	return mEditorModel .getSymmetrySegment();
    }

	public Segment getPlaneAxis( Polygon panel )
	{
		int[][] vertices = panel.getVertices();
		FreePoint p0 = new FreePoint( vertices[ 0 ], this.mDerivationModel );
		FreePoint p1 = new FreePoint( vertices[ 1 ], this.mDerivationModel );
		FreePoint p2 = new FreePoint( vertices[ 2 ], this.mDerivationModel );
		Segment s1 = new SegmentJoiningPoints( p0, p1 );
		Segment s2 = new SegmentJoiningPoints( p1, p2 );
		return new SegmentCrossProduct( s1, s2 );
	}

	public RealizedModel getRealizedModel()
	{
		return this .mRealizedModel;
	}

    public Iterable<Tool> getTools()
    {
        return this .tools .values();
    }
    
    public SymmetrySystem getSymmetrySystem()
    {
        return this .symmetrySystem;
    }

    public Map<String, SymmetrySystem> getSymmetrySystems()
    {
        return this .symmetrySystems;
    }
}
