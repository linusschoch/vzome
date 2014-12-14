
//(c) Copyright 2011, Scott Vorthmann.

package com.vzome.core.editor;

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import com.vzome.core.editor.Snapshot.SnapshotAction;
import com.vzome.core.math.DomUtils;
import com.vzome.core.render.RenderedModel;
import com.vzome.core.viewing.ThumbnailRenderer;
import com.vzome.core.viewing.ViewModel;


public class LessonModel
{
    private List pages = new ArrayList( 5 );
    
    private int pageNum = -1;

    private PropertyChangeSupport propertyChangeSupport = new PropertyChangeSupport( this );

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

    protected void firePropertyChange( String propertyName, boolean oldValue, boolean newValue )
    {
    	propertyChangeSupport .firePropertyChange( propertyName, oldValue, newValue );
    }

	public Element getXml( Document doc )
    {
        Element result = doc .createElement( "notes" );
        result .setAttribute( "xmlns:xml", "http://www.w3.org/XML/1998/namespace" );

        for ( Iterator it = pages .iterator(); it .hasNext(); )
            result .appendChild( ((PageModel) it .next() ) .getXml( doc ) );
        return result;
    }

    public void setXml( Element notesXml, int defaultEditNum, ViewModel defaultView )
    {
        pages .clear();
        
        NodeList nodes = notesXml .getChildNodes();
        for ( int i = 0; i < nodes .getLength(); i++ ) {
            Node node = nodes .item( i );
            if ( node instanceof Element ) {
                Element page = (Element) node;
                String title = page .getAttribute( "title" );
                Element viewElem = DomUtils .getFirstChildElement( page, "ViewModel" );
                ViewModel view = ( viewElem == null )? defaultView : new ViewModel( viewElem );
                Element contentElem = DomUtils .getFirstChildElement( page, "content" );
                String content = contentElem .getTextContent();
                String snapshot = page .getAttribute( "snapshot" );
                int snapshotIndex;
                if ( snapshot == null || snapshot .isEmpty() )
                {
                    String num = page .getAttribute( "editNum" );
                    int edit = ( num==null || num .isEmpty() )? defaultEditNum : Integer .parseInt( num );
                    snapshotIndex = -edit; // mark this for replacement in the next cycle
                }
                else
                    snapshotIndex = Integer .parseInt( snapshot );
                PageModel model = new PageModel( title, content, view, snapshotIndex );
                pages .add( model );
                pageNum = 0;
            }
        }
    }

	public void addPage( String name, String string, ViewModel view, int snapshot )
	{
        PageModel page = new PageModel( name, string, view, snapshot );
        pages .add( page );
        pageNum = 0;
	}

	public Iterator iterator()
	{
		return pages .iterator();
	}
    
    public void goToPage( final int newPageNum )
    {
        pageNum = newPageNum;
        final PageModel newPage = (PageModel) pages .get( newPageNum );
        
        ViewModel newView = newPage .getView();
        firePropertyChange( "currentView", null, newView );

        int newSnapshot = newPage .getSnapshot();
        firePropertyChange( "currentSnapshot", -1, newSnapshot );

        // UI will call getProperty as a result
        firePropertyChange( "currentPage", -1, newPageNum );
    }

	public void duplicatePage( ViewModel view )
	{
        int newPageNum = pageNum + 1;
        PageModel page = (PageModel) pages .get( pageNum );
        int snap = page .getSnapshot();
        page = new PageModel( "", "", view, snap );
        pages .add( newPageNum, page );
        firePropertyChange( "newElementAddedAt-" + newPageNum, false, true );
        goToPage( newPageNum );
        firePropertyChange( "thumbnailChanged", -1, newPageNum );
	}

	public void newSnapshotPage( int snapshotId, ViewModel view )
	{
        int newPageNum = pages .size();
        PageModel pc = new PageModel( "", "", view, snapshotId );
        pages .add( newPageNum, pc );
        if ( pages .size() == 1 )
            firePropertyChange( "has.pages", false, true );
        firePropertyChange( "newElementAddedAt-" + newPageNum, false, true );
        goToPage( newPageNum );
        firePropertyChange( "thumbnailChanged", -1, newPageNum );
	}
	
	public void deletePage()
	{
        int newPageNum = ( pageNum == pages .size() - 1 )? ( pageNum - 1 ) : pageNum;
        pages .remove( pageNum );
        firePropertyChange( "pageRemovedAt-" + pageNum, false, true );
        if ( pages .isEmpty() )
        {
            pageNum = -1;
            firePropertyChange( "has.pages", true, false );
        }
        else
        {
            goToPage( newPageNum );
        }
    }

	public int size()
	{
		return pages .size();
	}

	public void movePage( int fromNum, int toNum )
	{
		PageModel moving = (PageModel) pages .remove( fromNum );
        pages .add( toNum, moving );
        goToPage( toNum );
	}

	public boolean isEmpty()
	{
		return pages .isEmpty();
	}

	public boolean onFirstPage()
	{
		return pageNum == 0;
	}

	public boolean onLastPage()
	{
		return pageNum == pages. size() - 1;
	}

	public int getPageNum()
	{
		return pageNum;
	}

	public String getTitle()
	{
        PageModel page = (PageModel) pages .get( pageNum );
		return page .getTitle();
	}

	public String getContent()
	{
        PageModel page = (PageModel) pages .get( pageNum );
		return page .getContent();
	}

	public void setTitle( String string )
	{
        PageModel page = (PageModel) pages .get( pageNum );
        page .setTitle( string );
	}

	public void setContent( String string )
	{
        PageModel page = (PageModel) pages .get( pageNum );
        page .setContent( string );
	}

	public void goToFirstPage()
	{
		this .goToPage( 0 );
	}

	public void goToPreviousPage()
	{
        if ( pageNum > 0 )
        	this .goToPage( pageNum - 1 );
    }

	public void goToNextPage()
	{
        if ( pageNum < pages .size() - 1 )
        	this .goToPage( pageNum + 1 );
    }

	public void goToLastPage()
	{
		this .goToPage( pages .size() - 1 );
	}

	public void setView( ViewModel view )
	{
        PageModel page = (PageModel) pages .get( pageNum );
        page .setView( view );
        page .setThumbnailCurrent( false );
        goToPage( pageNum );
        firePropertyChange( "thumbnailChanged", -1, pageNum );
	}

	public void refresh()
	{
        if ( pageNum >= 0 )
            goToPage( pageNum );
	}

	public ViewModel getPageView( int num )
	{
        PageModel page = (PageModel) pages .get( num );
        return page .getView();
	}

	public boolean onPage( int page )
	{
		return pageNum == page;
	}
    
    public void updateThumbnail( final int pageNum, final Snapshot.Recorder recorder, final ThumbnailRenderer renderer )
    {
        firePropertyChange( "has.pages", false, true );
        final PageModel page = (PageModel) pages .get( pageNum );
        if ( page .thumbnailIsCurrent() )
            return;
        page .setThumbnailCurrent( true );

        recorder .actOnSnapshot( page .getSnapshot(), new SnapshotAction() {
			
			public void actOnSnapshot( RenderedModel snapshot )
			{
//		        firePropertyChange( "newElementAddedAt-" + pageNum, false, true );
				renderer .captureSnapshot( snapshot, page .getView(), 80, new ThumbnailRenderer.Listener()
				{
					public void thumbnailReady( Object thumbnail )
					{
		                Logger logger = Logger.getLogger( "com.vzome.core.thumbnails" );
		                if ( logger .isLoggable( Level.FINER ) )
		                    logger .finer( "thumbnailReady: " + page .getSnapshot() + " for page " + pageNum );

		                page .setThumbnail( thumbnail );
		                firePropertyChange( "thumbnailChanged-" + pageNum, null, thumbnail );
		            }
				} );
			}
		});
    }
}
