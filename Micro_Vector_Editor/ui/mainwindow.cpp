#include "mainwindow.h"
#include <QWheelEvent>
MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    scene = new mouseEvents(this);
    scene->modelVector = &diagramObjects;   // linking modelVector to diagramObjects
    scene->undo_stack = &undo_s;            // same for stacks 
    scene->redo_stack = &redo_s;
    scene->setSceneRect(0, 0, 800, 600);    // scene size defined
    connect(scene, &mouseEvents::sceneChanged, this, &MainWindow::updateSceneFromModel);    // slot for sceneChanged
    view = new QGraphicsView(scene, this);  // new view using graphics view
    view->setBackgroundBrush(Qt::white);       // background color
    setCentralWidget(view);             // Central viewing position
    setupMenubar();     // Setting up menubar and toolbar
    setupToolbar();
}

MainWindow::~MainWindow() = default;

void MainWindow::saveState() { //saveState same definition for undo and redo
    std::vector<std::unique_ptr<GraphicsObject>> snapshot;
    for (const auto& obj : diagramObjects) {
        snapshot.push_back(obj->clone());
    }
    undo_s.push(std::move(snapshot));
    while (!redo_s.empty()) redo_s.pop();
}
void MainWindow::wheelEvent(QWheelEvent *event) {       // CTRL + SCROLL changes view distance using scaling by const factor
    if (event->modifiers() & Qt::ControlModifier) {
        const double scaleFactor = 1.05;        // scaling factor 
        if (event->angleDelta().y() > 0) {
            view->scale(scaleFactor, scaleFactor);
        } else {
            view->scale(1.0 / scaleFactor, 1.0 / scaleFactor);
        }
        event->accept();       // Event dies here and is completed do not pass to anyone 
    } else {
        QMainWindow::wheelEvent(event);
    }
}