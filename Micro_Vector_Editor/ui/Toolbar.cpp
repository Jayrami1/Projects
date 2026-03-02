#include "mainwindow.h"
#include "Text.h"      
#include "Rectangle.h" 
#include <QToolBar>
#include <QAction>
#include <QSpinBox>
#include <QFontComboBox>
#include <QColorDialog>
#include <QLabel>
#include <QWidgetAction>
#include<QActionGroup>
void MainWindow::setupToolbar() {
    QToolBar *shapeBar = new QToolBar("Shapes", this);  //Toolbar setup
    addToolBar(Qt::LeftToolBarArea, shapeBar);  //On left
    shapeBar->setIconSize(QSize(30, 30));   //Icon size defined
    shapeBar->setToolButtonStyle(Qt::ToolButtonIconOnly);       //Button style icon
    QActionGroup *toolGroup = new QActionGroup(this);   //Toolgroup involoves all tools
    toolGroup->setExclusive(true);                      //Only one selected at a time
    auto addTool = [&](const QString &name, mouseEvents::ToolType type,const QString &key,const QString &iconPath) {    //Functor for easy calling
        QAction* act = shapeBar->addAction(QIcon(iconPath),name);   //QIcon for icon and Qaction to define action
        act->setShortcut(key);act->setCheckable(true);      //Setting shortcut and whether it is checkable or not
        toolGroup->addAction(act);
        connect(act, &QAction::triggered, this, [this, type]() { scene->activeTool = type; });//Signal connection to slots
        if (type == mouseEvents::SelectTool) act->setChecked(true);
    };
    addTool("Select", mouseEvents::SelectTool, "S",":/icons/select.svg");   // Adding all tools like select,rect,circle,hex,line,freehand,text here and giving iconpath
    shapeBar->addSeparator();
    addTool("Rect", mouseEvents::RectTool, "R",":/icons/rectangle.svg");
    addTool("Circle", mouseEvents::CircleTool, "C",":/icons/circle.svg");
    addTool("Line", mouseEvents::LineTool, "L",":/icons/line.svg");
    addTool("Hexagon", mouseEvents::HexagonTool, "H",":/icons/hex.svg");
    addTool("Text", mouseEvents::TextTool, "T",":/icons/text.svg");
    addTool("FreeHand", mouseEvents::FreeTool, "F",":/icons/freehand.svg");
    shapeBar->addSeparator();
    QAction *fillAct = shapeBar->addAction(QIcon(":/icons/colorfill.svg"),"Fill Color");    //Fill color action created with icon 
    connect(fillAct, &QAction::triggered, this, [this]() {
        QColor c = QColorDialog::getColor(Qt::black, this);     // Open QColorDialog to select color and give to c 
        if(c.isValid()) {   // for valid c
            if(auto s = scene->getSelectedObject()) {       // if selected object then change its color in scene and update
                saveState(); s->fill_Color = c; updateSceneFromModel(); 
            } else scene->setFillColor(c); // else for object
        }
    });
    QAction *strokeAct = shapeBar->addAction(QIcon(":/icons/stroke.png"),"Stroke Color");    //Similar to fill just ffor stroke
    connect(strokeAct, &QAction::triggered, this, [this]() {
        QColor c = QColorDialog::getColor(Qt::black, this);
        if(c.isValid()) {
            if(auto s = scene->getSelectedObject()) { 
                saveState(); s->stroke_Color = c; updateSceneFromModel(); 
            } else scene->setStrokeColor(c);
        }
    });
    shapeBar->addSeparator();
    shapeBar->addWidget(new QLabel("Font Size",this));  // Added widget for font size of SpinBox type (+- values based on arrows)
    QSpinBox *fontSpin = new QSpinBox(this);
    fontSpin->setRange(5, 100); // Range for size 5 - 100
    fontSpin->setValue(20); //default 20
    QWidgetAction *fontAct = new QWidgetAction(this); // Defining action on this widget
    fontAct->setDefaultWidget(fontSpin);
    shapeBar->addAction(fontAct);       //connect this together and update font size based on val of SpinBox
    connect(fontSpin, &QSpinBox::valueChanged, this, [this](int val){
        scene->setFontSize(val);
        if(auto t = dynamic_cast<Text*>(scene->getSelectedObject())){
            saveState();t->font_size = val;updateSceneFromModel();
        }
    });
    shapeBar->addWidget(new QLabel("Font Style",this)); // Added widget for font-style 
    QFontComboBox *fontCombo = new QFontComboBox(this); // Uses std fontComboBox involving font-style in system
    fontCombo->setCurrentFont(QFont("Arial"));  // Default Arial style
    shapeBar->addWidget(fontCombo); 
    connect(fontCombo, &QFontComboBox::currentFontChanged, this, [this](const QFont &f){
        scene->setFontFamily(f.family());   // update the fontfamily
        if(auto t = dynamic_cast<Text*>(scene->getSelectedObject())) {
            saveState();t->font_family = f.family().toStdString();updateSceneFromModel();     // For text selected the type is changed and updated 
        }
    });
    shapeBar->addWidget(new QLabel("Rect Radius:", this));  // Same as font_size just for radius of rounded rectangle
    QSpinBox *radSpin = new QSpinBox(this);
    radSpin->setRange(0, 100);
    QWidgetAction *radAct = new QWidgetAction(this);
    radAct->setDefaultWidget(radSpin);
    shapeBar->addAction(radAct);
    connect(radSpin, &QSpinBox::valueChanged, this, [this](int val){
        scene->setCornerRadius(val);
        if(auto r = dynamic_cast<Rectangle*>(scene->getSelectedObject())){
            saveState();r->rx = val; r->ry = val;updateSceneFromModel();
        }
    });
    shapeBar->addWidget(new QLabel(" Stroke Width:", this));    // Same as font_size just for stroke width
    QSpinBox *strokeSpin = new QSpinBox(this);
    strokeSpin->setRange(1, 20);strokeSpin->setValue(1);
    shapeBar->addWidget(strokeSpin);
    connect(strokeSpin, &QSpinBox::valueChanged, this, [this](int val){
        scene->setStrokeWidth(val); 
        if(auto s = scene->getSelectedObject()){
            saveState();s->strokeWidth = val;updateSceneFromModel();
        }
    });
}