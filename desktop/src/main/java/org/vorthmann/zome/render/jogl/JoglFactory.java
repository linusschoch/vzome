
package org.vorthmann.zome.render.jogl;

import java.util.List;

import org.vorthmann.j3d.J3dComponentFactory;

import com.jogamp.nativewindow.CapabilitiesImmutable;
import com.jogamp.opengl.DefaultGLCapabilitiesChooser;
import com.jogamp.opengl.GLAutoDrawable;
import com.jogamp.opengl.GLCapabilities;
import com.jogamp.opengl.GLCapabilitiesChooser;
import com.jogamp.opengl.GLCapabilitiesImmutable;
import com.jogamp.opengl.GLProfile;
import com.jogamp.opengl.awt.GLCanvas;
import com.jogamp.opengl.awt.GLJPanel;
import com.vzome.core.render.Scene;
import com.vzome.desktop.awt.RenderingViewer;

public class JoglFactory implements J3dComponentFactory
{    
    // MSAA (anti-aliasing) implemented per
    //   https://jogamp.org/jogl-demos/src/demos/multisample/Multisample.java
    
    // Simple class to warn if results are not going to be as expected
    static class MultisampleChooser extends DefaultGLCapabilitiesChooser {
      public int chooseCapabilities(GLCapabilities desired,
                                    List<? extends CapabilitiesImmutable> available,
                                    int windowSystemRecommendedChoice) {
        boolean anyHaveSampleBuffers = false;
        for (int i = 0; i < available.size(); i++) {
          GLCapabilitiesImmutable caps = (GLCapabilitiesImmutable) available.get(i);
          if (caps != null && caps.getSampleBuffers()) {
            anyHaveSampleBuffers = true;
            break;
          }
        }
        int selection = super.chooseCapabilities(desired, available, windowSystemRecommendedChoice);
        if (!anyHaveSampleBuffers) {
          System.err.println("WARNING: antialiasing will be disabled because none of the available pixel formats had it to offer");
        } else if(selection>=0) {
          GLCapabilitiesImmutable caps = (GLCapabilitiesImmutable) available.get(selection);
          if (!caps.getSampleBuffers()) {
            System.err.println("WARNING: antialiasing will be disabled because the DefaultGLCapabilitiesChooser didn't supply it");
          }
        }
        return selection;
      }
    }

    @Override
    public RenderingViewer createRenderingViewer( Scene scene, boolean lightweight )
    {
        // This is apparently necessary to avoid "just black" GLJPanels
        // See https://forum.jogamp.org/reshape-not-called-in-2nd-GLCanvas-td4042121.html
        System .setProperty( "jogl.gljpanel.noglsl", "true" );
        
        GLProfile glprofile = GLProfile .getDefault();
        GLCapabilities glcapabilities = new GLCapabilities( glprofile );
        GLCapabilitiesChooser chooser = new MultisampleChooser();

        glcapabilities .setSampleBuffers(true);
        glcapabilities .setNumSamples(4);

        glcapabilities .setDepthBits( 24 );

        // GLCanvas for the trackball view on the Mac gets "left behind" when resizing the window,
        //  a defect in JOGL.  The remedy is to use the lightweight GLJPanel for that situation,
        //  which behaves correctly, though it delivers a much lower frame rate than GLCanvas.
        
        GLAutoDrawable glcanvas = lightweight? new GLJPanel( glcapabilities, chooser ) : new GLCanvas( glcapabilities, chooser, null );
        
        return new JoglRenderingViewer( scene, glcanvas );
    }
}
