package com.vzome.core.kinds;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;

import org.junit.Test;

import com.vzome.api.Tool;
import com.vzome.api.Tool.Factory;
import com.vzome.core.algebra.AlgebraicField;
import com.vzome.core.algebra.AlgebraicNumber;
import com.vzome.core.commands.Command;
import com.vzome.core.commands.CommandAxialSymmetry;
import com.vzome.core.commands.CommandSymmetry;
import com.vzome.core.commands.CommandTauDivision;
import com.vzome.core.editor.FieldApplication;
import com.vzome.core.editor.FieldApplication.SymmetryPerspective;
import com.vzome.core.editor.ToolsModel;
import com.vzome.core.generic.Utilities;
import com.vzome.core.math.symmetry.Direction;
import com.vzome.core.math.symmetry.QuaternionicSymmetry;
import com.vzome.core.math.symmetry.Symmetry;
import com.vzome.core.render.Shapes;
import com.vzome.core.tools.AxialStretchTool;
import com.vzome.core.tools.BookmarkTool;
import com.vzome.core.tools.IcosahedralToolFactory;
import com.vzome.core.tools.InversionTool;
import com.vzome.core.tools.LinearMapTool;
import com.vzome.core.tools.MirrorTool;
import com.vzome.core.tools.ModuleTool;
import com.vzome.core.tools.OctahedralToolFactory;
import com.vzome.core.tools.PlaneSelectionTool;
import com.vzome.core.tools.ProjectionTool;
import com.vzome.core.tools.RotationTool;
import com.vzome.core.tools.ScalingTool;
import com.vzome.core.tools.TranslationTool;
import com.vzome.fields.sqrtphi.SqrtPhiFieldApplication;

public class FieldApplicationTest
{
    private static final Logger LOGGER = Logger.getLogger( new Throwable().getStackTrace()[0].getClassName() );
    
    private static Collection<FieldApplication> getTestFieldApplications() {
        // preserve insertion order for consistent test result
        Collection<FieldApplication> result = new ArrayList<>();
        result.add( new GoldenFieldApplication());
        result.add( new RootTwoFieldApplication());
        result.add( new RootThreeFieldApplication());
        result.add( new HeptagonFieldApplication());
        result.add( new SqrtPhiFieldApplication());
        result.add( new SnubDodecFieldApplication());
        return result;
    }
    
    @Test
    public void testFieldApplications()
    {
//        LOGGER.setLevel(Level.FINE);
        System.out.println(new Throwable().getStackTrace()[0].getMethodName() + " " + Utilities.thisSourceCodeLine());
        for(FieldApplication app : getTestFieldApplications()) {
            final String appName = app.getName();
            assertNull("getSymmetryPerspective('???')", app.getSymmetryPerspective("???")); // shouldn't throw any exceptions
            
            Collection<SymmetryPerspective> perspectives = app.getSymmetryPerspectives();
            assertFalse(perspectives.isEmpty());
            SymmetryPerspective defaultPerspective = app.getDefaultSymmetryPerspective();
            assertNotNull(defaultPerspective);
            assertTrue(perspectives.contains(defaultPerspective));
            testGetLegacyCommand(app);
            testRegisterToolFactories(app);
            
            Set<String> names = new HashSet<>();
            for(SymmetryPerspective perspective : perspectives) {
                testSymmetryPerspective(perspective, appName);
                String name = perspective.getName();
                assertFalse("SymmetryPerspective names must be unique within a FieldApplication.", names.contains(name));
                names.add(name);
                
                SymmetryPerspective sp = app.getSymmetryPerspective(name);
                boolean same = perspective == sp; // be sure to test same-ness with "==" rather than equals()
                assertTrue(appName + "." + name + " ? " + sp.getName(), same);
                
                testGetLegacyCommand(perspective, appName);
                testGeometries(perspective, appName);
                testCreateToolFactories(perspective, appName);
                // Note that we don't test predefineTools() here... too much work to initialize the params.
                testModelResourcePath(perspective, appName);
            }
            testGetQuaternionSymmetry(app);
        }
    }

    private void testSymmetryPerspective(SymmetryPerspective perspective, String appName) 
    {
        final String symmName = perspective.getSymmetry().getName();
        final String name = perspective.getName();
        assertEquals(appName + ".symmetryName", symmName, name);
        
        switch(name) {
        case "octahedral":
            noop();
            break;
            
        case "icosahedral":
            noop();
            break;
            
        case "dodecagonal":
            noop();
            break;
            
        case "pentagonal":
            noop();
            break;
            
        case "heptagonal antiprism":
            noop();
            break;
            
        case "heptagonal antiprism corrected":
            noop();
            break;
            
        case "synestructics":
            noop();
            break;
            
        default:
            fail(appName + " has an unexpected perspective name: " + name);
        }
    }
    
    private void testGetLegacyCommand(FieldApplication app)
    {
        testCommand(app, "pointsymm");
        testCommand(app, "mirrorsymm");
        testCommand(app, "translate");
        testCommand(app, "centroid");
        testCommand(app, "hideball");
        testCommand(app, "hide");
        testCommand(app, "panel");
        testCommand(app, "midpoint");
        
        assertTrue(app.getLegacyCommand("octasymm") instanceof CommandSymmetry);
        assertNull("getLegacyCommand('???')", app.getLegacyCommand("???")); // shouldn't throw any exceptions
        
        String name = app.getName();
        switch(name) {
        case "golden":
            assertTrue(app.getLegacyCommand("tauDivide") instanceof CommandTauDivision);
            break;
            
        case "rootTwo":
            noop();
            break;
            
        case "rootThree":
            noop();
            break;
            
        case "heptagon":
            noop();
            break;
            
        case "sqrtPhi":
            noop();
            break;
            
        case "snubDodec":
            assertTrue(app.getLegacyCommand("tauDivide") instanceof CommandTauDivision);
            break;
            
        default:
            fail("unexpected FieldApplication name: " + name);
            break;
        }
    }

    private void testGetLegacyCommand(SymmetryPerspective perspective, String appName)
    {
        assertTrue(perspective.getLegacyCommand("octasymm") instanceof CommandSymmetry);
        assertNull("getLegacyCommand('???')", perspective.getLegacyCommand("???")); // shouldn't throw any exceptions
        
        String name = perspective.getName();
        switch(name) {
        case "octahedral":
            noop();
            break;
            
        case "icosahedral":
            assertTrue(perspective.getLegacyCommand("icosasymm") instanceof CommandSymmetry);
            assertTrue(perspective.getLegacyCommand("tetrasymm") instanceof CommandSymmetry);
            assertTrue(perspective.getLegacyCommand("axialsymm") instanceof CommandAxialSymmetry);
            testCommand(perspective, "h4symmetry"); 
            testCommand(perspective, "h4rotations"); 
            testCommand(perspective, "IxTsymmetry"); 
            testCommand(perspective, "TxTsymmetry"); 
            testCommand(perspective, "vanOss600cell");
            break;
            
        case "dodecagonal":
            assertTrue(perspective.getLegacyCommand("dodecagonsymm") instanceof CommandSymmetry);
            break;
            
        case "pentagonal":
            assertTrue(perspective.getLegacyCommand("axialsymm") instanceof CommandAxialSymmetry);
            break;
            
        case "heptagonal antiprism":
            assertTrue(perspective.getLegacyCommand("axialsymm") instanceof CommandAxialSymmetry);
            break;
            
        case "heptagonal antiprism corrected":
            assertTrue(perspective.getLegacyCommand("axialsymm") instanceof CommandAxialSymmetry);
            break;
            
        case "synestructics":
            noop();
            break;
            
        default:
            fail(appName + " has an unexpected perspective name: " + name);
        }
    }

    private void testCommand(FieldApplication app, String action) {
        testCommand(app.getName(), action, app.getLegacyCommand(action));
    }

    private void testCommand(SymmetryPerspective perspective, String action) {
        testCommand(perspective.getName(), action, perspective.getLegacyCommand(action));
    }

    private void testCommand(String source, String action, Command command) {
        assertNotNull(source + ".getLegacyCommand( '" + action + "' ) should not be null", command);
    }

    private void testGeometries(SymmetryPerspective perspective, String appName) 
    {
        assertNotNull(perspective);
        String name = perspective.getName();
        List<Shapes> geometries = perspective.getGeometries();
        Shapes defaultGeometry = perspective.getDefaultGeometry();
        assertNotNull(name, defaultGeometry);
        assertFalse(name, geometries.isEmpty());
        assertTrue(appName + "." + name + " SymmetryPerspective must contain defaultGeometry: " + defaultGeometry.getName(), geometries.contains(defaultGeometry));

        for(Shapes shapes : geometries) {
            logConnectorShapes(appName, name, shapes);
            testConnectorShapes(perspective.getSymmetry(), shapes);
        }
    }

    private void logConnectorShapes(String appName, String perspectiveName, Shapes shapes)
    {
        if(LOGGER.isLoggable(Level.FINE)) {
            String delim = "\t\t\t";
            String alias = shapes.getAlias();
            alias = (alias == null) ? "" : alias;
            StringBuilder buf = new StringBuilder();
            buf.append(appName)             .append(delim);
            buf.append(perspectiveName)     .append(delim);
            buf.append(shapes.getPackage()) .append(delim);
            buf.append(shapes.getName())    .append(delim);
            buf.append(alias)               .append(delim);
//            System.out.println(buf.toString());
            LOGGER.fine(buf.toString());
        }
    }

    private void testConnectorShapes(Symmetry symmetry, Shapes shapes) 
    {
        assertNotNull(shapes);
        String name = shapes.getName();
        assertNotNull(name + ".getConnectorShape()", shapes.getConnectorShape());
        AlgebraicField field = symmetry.getField();
        AlgebraicNumber length = field.createPower(1);
        for(Direction dir : symmetry) {
            assertNotNull(name + ".getStrutShape()", shapes.getStrutShape(dir, length));
        }
    }
    
    private void testRegisterToolFactories(FieldApplication app)
    {
        Map<String, Factory> toolFactories = new HashMap<>();
        ToolsModel tools = null;
        app.registerToolFactories( toolFactories, tools );
        
        assertTrue(toolFactories .get( "RotationTool") instanceof RotationTool.Factory);
        assertTrue(toolFactories .get( "ScalingTool") instanceof ScalingTool.Factory);
        
        assertTrue(toolFactories .get( "InversionTool") instanceof InversionTool.Factory);
        assertTrue(toolFactories .get( "MirrorTool") instanceof MirrorTool.Factory);
        assertTrue(toolFactories .get( "TranslationTool") instanceof TranslationTool.Factory);
        assertTrue(toolFactories .get( "ProjectionTool") instanceof ProjectionTool.Factory);
        assertTrue(toolFactories .get( "BookmarkTool") instanceof BookmarkTool.Factory);
        assertTrue(toolFactories .get( "LinearTransformTool") instanceof LinearMapTool.Factory);
    
        // These tool factories have to be available for loading legacy documents.
        assertTrue(toolFactories .get( "LinearMapTool") instanceof LinearMapTool.Factory);
        assertTrue(toolFactories .get( "ModuleTool") instanceof ModuleTool.Factory);
        assertTrue(toolFactories .get( "PlaneSelectionTool") instanceof PlaneSelectionTool.Factory);
        
        String name = app.getName();
        switch(name) {
        case "golden":
            assertTrue(toolFactories .get( "SymmetryTool") instanceof IcosahedralToolFactory);
            assertTrue(toolFactories .get( "AxialStretchTool") instanceof AxialStretchTool.Factory);
            break;
            
        case "rootTwo":
            assertTrue(toolFactories .get( "SymmetryTool") instanceof OctahedralToolFactory);
            break;
            
        case "rootThree":
            assertTrue(toolFactories .get( "SymmetryTool") instanceof OctahedralToolFactory);
            break;
            
        case "heptagon":
            assertTrue(toolFactories .get( "SymmetryTool") instanceof OctahedralToolFactory);
            break;
            
        case "sqrtPhi":
            assertTrue(toolFactories .get( "SymmetryTool") instanceof OctahedralToolFactory);
            break;
            
        case "snubDodec":
            assertTrue(toolFactories .get( "SymmetryTool") instanceof IcosahedralToolFactory);
            assertTrue(toolFactories .get( "AxialStretchTool") instanceof AxialStretchTool.Factory);
            break;
            
        default:
            fail("unexpected FieldApplication name: " + name);
            break;
        }
    }
    
    private void testCreateToolFactories(SymmetryPerspective perspective, String appName)
    {
        ToolsModel tools = null;
        for(Tool.Kind kind : Tool.Kind.values()) {
            List<Tool.Factory> toolFactoryList = perspective.createToolFactories(kind, tools);
            assertNotNull("createToolFactories()", toolFactoryList);
            
            String name = perspective.getName();
            String source = appName + "." + name;
            switch(name) {
            case "octahedral":
                verifyToolFactoryCounts(name, kind, toolFactoryList, 5, 4, 1);
                break;
                
            case "icosahedral":
                verifyToolFactoryCounts(name, kind, toolFactoryList, 5, 4, 7);
                break;
                
            case "dodecagonal":
                verifyToolFactoryCounts(name, kind, toolFactoryList, 4, 4, 1);
                break;
                
            case "pentagonal":
                verifyToolFactoryCounts(name, kind, toolFactoryList, 3, 3, 1);
                break;
                
            case "heptagonal antiprism":
                verifyToolFactoryCounts(name, kind, toolFactoryList, 3, 3, 1);
                break;
                
            case "heptagonal antiprism corrected":
                verifyToolFactoryCounts(name, kind, toolFactoryList, 3, 3, 1);
                break;
                
            case "synestructics":
                verifyToolFactoryCounts(name, kind, toolFactoryList, 5, 4, 1);
                break;
                
            default:
                fail(appName + " has an unexpected perspective name: " + name);
            }
        }
    }
    
    private void verifyToolFactoryCounts(String source, Tool.Kind kind, List<Tool.Factory> toolFactoryList, int symmetryCount, int transformCount, int linearMapCount)
    {
        String msg = source + "\t" + kind;
        logToolFactoryList(msg, toolFactoryList);
        switch(kind) {
        case SYMMETRY:
            assertEquals(msg, symmetryCount, toolFactoryList.size());
            break;
            
        case TRANSFORM:
            assertEquals(msg, transformCount, toolFactoryList.size());
            break;
            
        case LINEAR_MAP:
            assertEquals(msg, linearMapCount, toolFactoryList.size());
            break;

        default:
            fail("unexpected kind: " + kind); // in case we add more some day...
        }
    }
    
    public void logToolFactoryList(String source, List<Tool.Factory> toolFactoryList)
    {
        if(LOGGER.isLoggable(Level.FINE)) {
            StringBuilder buf = new StringBuilder();
            for(Factory toolFactory : toolFactoryList) {
                buf.append(source)
                .append("\t")
                .append(toolFactory.getClass().getName())
                .append("\n");
            }
//            System.out.println(buf.toString());
            LOGGER.fine(buf.toString());
        }
    }

    private void testModelResourcePath(SymmetryPerspective perspective, String appName)
    {
        String name = perspective.getName();
        String path = perspective.getModelResourcePath();
        String msg = appName + "." + name + ":\t\t" + path;
//        System.out.println(msg);
        assertTrue(msg, path.matches("^org/vorthmann/zome/app/.*\\.vZome"));
    }
    
    private static String[] quaternionSymmetryNames = {"H_4", "H4_ROT", "2T"};
    
    private void testGetQuaternionSymmetry(FieldApplication app)
    {
        for(String qsName : quaternionSymmetryNames) {
            String appName = app.getName();
            String msg = appName + "." + qsName ;

            QuaternionicSymmetry qSymm = app.getQuaternionSymmetry(qsName);
            switch(appName) {
            case "golden":
                assertNotNull(msg, qSymm);
                break;
                
            case "rootTwo":
                assertNull(msg, qSymm);
                break;
                
            case "rootThree":
                assertNull(msg, qSymm);
                break;
                
            case "heptagon":
                assertNull(msg, qSymm);
                break;
                
            case "sqrtPhi":
                if(qsName == "H_4") {
                    assertNotNull(msg, qSymm);
                } else {
                    assertNull(msg, qSymm);
                }
                break;
                
            case "snubDodec":
                assertNotNull(msg, qSymm);
                break;
                
            default:
                fail("unexpected FieldApplication name: " + appName);
                break;
            }
        }
    }
    
    /**
     * Unused cases in switch statements can use noop() 
     * to verify code coverage tests in eclipse 
     * since execution of plain break statements are not indicated otherwise
     */
    private void noop() {}
}
