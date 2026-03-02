#pragma once
#include <QGraphicsScene>
#include <QGraphicsSceneMouseEvent>
#include <stack>
#include <memory>
#include "GraphicsObject.h"

class mouseEvents : public QGraphicsScene {
    Q_OBJECT
public:
    // enumerating tooltypes for easier access
    enum ToolType { None, RectTool, CircleTool, LineTool, HexagonTool, TextTool, FreeTool, SelectTool };
    ToolType activeTool = None; // default selection
    // Needs explicit mentioning like new keyword to defining allowing more control on code 
    explicit mouseEvents(QObject *parent = nullptr) : QGraphicsScene(parent) {} 
    void mousePressEvent(QGraphicsSceneMouseEvent *event) override; // Press move and release move events 
    void mouseMoveEvent(QGraphicsSceneMouseEvent *event) override;
    void mouseReleaseEvent(QGraphicsSceneMouseEvent *event) override;

    void setStrokeColor(const QColor &c) { currentStroke = c; }     // As name suggests for each of them
    void setFillColor(const QColor &c) { currentFill = c; }
    void setStrokeWidth(int w) { currentWidth = w; }
    void setFontSize(int s) { curr_fs = s; }
    void setCornerRadius(int r) { curr_r = r; }
    void setFontFamily(const QString &f) { curr_ff = f; }
    GraphicsObject* getSelectedObject() const { return selectedObject; }    // Returns selected object 
    void clearSelection() { selectedObject = nullptr; } // make it nullptr 

    std::vector<std::unique_ptr<GraphicsObject>>* modelVector = nullptr;  // For snapshotting entire scene in one go 
    std::stack<std::vector<std::unique_ptr<GraphicsObject>>>* undo_stack = nullptr; // Stacks for undo and redo
    std::stack<std::vector<std::unique_ptr<GraphicsObject>>>* redo_stack = nullptr;

signals:
    void sceneChanged();    // Bound to slot in mainwindow

private:
    GraphicsObject* selectedObject = nullptr;   // Current parameters 
    QGraphicsItem* previewItem = nullptr;
    QPointF startPoint;
    bool isMoving = false;
    bool isResizing = false;
    int dragHandleIndex = 0;
    QString curr_ff = "Arial"; 
    int curr_fs = 20;
    int curr_r = 0;
    QColor currentStroke = Qt::black;
    QColor currentFill = Qt::white;
    int currentWidth = 1;
    bool interactionStateSaved = false;

    void saveState();   // helper functions for events
    void handleSelectionPress(QGraphicsSceneMouseEvent *event);
    void handleToolPress(QGraphicsSceneMouseEvent *event);
    void handleMoveResize(QGraphicsSceneMouseEvent *event);
    void updatePreview(QGraphicsSceneMouseEvent *event);
    void finalizeShape(QGraphicsSceneMouseEvent *event);
    void applyPreviewStyle();
};