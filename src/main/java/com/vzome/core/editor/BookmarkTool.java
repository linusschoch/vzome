
//(c) Copyright 2008, Scott Vorthmann.  All rights reserved.

package com.vzome.core.editor;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

import org.w3c.dom.Element;

import com.vzome.core.commands.XmlSaveFormat;
import com.vzome.core.commands.Command.Failure;
import com.vzome.core.construction.Construction;
import com.vzome.core.construction.ModelRoot;
import com.vzome.core.model.Manifestation;
import com.vzome.core.model.RealizedModel;

public class BookmarkTool extends ChangeConstructions implements Tool
{
    private String name;
    
    private final List bookmarkedConstructions = new ArrayList();
        
    private Tool.Registry tools;
    
    public BookmarkTool( String name, Selection selection, RealizedModel realized, ModelRoot root, Tool.Registry tools )
    {
        super( selection, realized, false );
        this.name = name;
        this.tools = tools;
        Duplicator duper = new Duplicator( null, root, null );
        for (Iterator iterator = mSelection.iterator(); iterator.hasNext();) {
			Manifestation man = (Manifestation) iterator.next();
			Construction result = duper .duplicateConstruction( man );
	        bookmarkedConstructions .add( result );
		}
    }

	public boolean isSticky()
    {
        return true;
    }

    public void perform() throws Failure
    {
        defineTool();
    }

    protected void defineTool()
    {
        tools .addTool( this );
    }

    public boolean needsInput()
    {
    	return false;
    }

    public void prepare( ChangeConstructions edit )
    {
        for ( Iterator cons = bookmarkedConstructions .iterator(); cons .hasNext(); ) {
        	Construction con = (Construction) cons .next();
        	edit .addConstruction( con );
        	edit .manifestConstruction( con );
        }
        edit .redo();
    }

	public void complete( ChangeConstructions applyTool ) {}

    public void performEdit( Construction c, ChangeConstructions applyTool ) {}
    
	public void performSelect( Manifestation man, ChangeConstructions applyTool ) {}

    public void redo()
    {
        // TODO manifest a symmetry construction... that is why this class extends ChangeConstructions
        // this edit is now sticky (not really undoable)
//        tools .addTool( this );
    }

    public void undo()
    {
        // this edit is now sticky (not really undoable)
//        tools .removeTool( this );
    }

    public String getName()
    {
        return name;
    }

    protected String getXmlElementName()
    {
        return "BookmarkTool";
    }
    
    protected void getXmlAttributes( Element element )
    {
        element .setAttribute( "name", this.name );
    }

    protected void setXmlAttributes( Element element, XmlSaveFormat format ) throws Failure
    {
        this.name = element .getAttribute( "name" );
    }

    public String getCategory()
    {
        return "bookmark";
    }

    public String getDefaultName()
    {
        return "SHOULD NOT HAPPEN";
    }
}
