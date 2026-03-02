#pragma once
#include <QMainWindow>
#include<QGraphicsScene>
#include<QGraphicsView>
#include<QMenuBar>
#include<QToolBar>
#include<QAction>
#include "GraphicsObject.h"
#include "mouseEvents.h"

class MainWindow : public QMainWindow
{
    Q_OBJECT

public:     // Explicit mentioning to prevent errors
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow();
    void wheelEvent(QWheelEvent *event) override;       // For zoom events using scroll and CTRL

private slots:  // SLOTS for signals to be defined in menubar and toolbar
    void savefile();
    void newfile();
    void openfile();
    void saveAs();
    void erase();
    void cut();
    void copy();
    void paste();
    void undo();
    void redo();

private:        // To setup menubar and toolbar (precompute type)
    void setupMenubar();
    void setupToolbar();
    void saveState();   // saveState function to take care of stacks
    mouseEvents *scene; // scene is defined to be of type mouseEvents (Custom graphicsScene)
    QGraphicsView *view;    // Decides viewing distance and angle 
    QString currentFilePath;    // Filepath for saving and opening files
    void updateSceneFromModel();    // Updating scene from vectors 
    std::vector<std::unique_ptr<GraphicsObject>> diagramObjects;    //modelVector of this class
    std::stack<std::vector<std::unique_ptr<GraphicsObject>>>undo_s; // stacks but not reference stacks
    std::stack<std::vector<std::unique_ptr<GraphicsObject>>>redo_s;
    std::unique_ptr<GraphicsObject>prev;    // for cut/copy cases
};
