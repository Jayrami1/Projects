#pragma once
#include <QColor>
#include <QPointF>
#include<stack>
#include <QRectF>
class GraphicsObject {   //Parent class for all objects
public:
    virtual ~GraphicsObject() = default;             //Virtual allows to define the type of object at run time (for destructor)
    virtual void move(double dx, double dy) = 0;     // Move function allows its children objects to use dx dy to update to its new position
    virtual void resize(double dx, double dy) = 0;   // Resize function changes the object dimensions as per dx dy
    QColor stroke_Color = Qt::black;                 // Stroke_color saves the stroke_color of current condition using color_dialog 
    QColor fill_Color = Qt::black;                   // Same as stroke color just for interior 
    int strokeWidth = 1;                             //Stores integral width of border
    virtual std::string SVG() const = 0;             // Prints the SVG of any given object (Const provides immutability)
    virtual bool contains(QPointF p) const = 0;      //Function that check whether given point p is inside the object or not
    virtual void pastePos(double newX, double newY) = 0;        // PastePOS gives the location of where the object us to be pasted
    virtual std::unique_ptr<GraphicsObject> clone() const = 0; // Since we require to get object for stacks in UNDO we need to create a clone 
    void setFillColor(const QColor& c) {fill_Color = c;}       // AS the name suggests
    void setStrokeColor(const QColor& c) {stroke_Color=c;}     // AS the name suggests
    void setStrokeWidth(int w) { strokeWidth = w;}             // REALLY ?!
    virtual QRectF getBounds() const = 0;              // getBounds gives us the container values in order to keep the object inside slected box
};
