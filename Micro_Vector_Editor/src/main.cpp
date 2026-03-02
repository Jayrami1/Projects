#include <QApplication>
#include"mainwindow.h"

int main(int argc, char *argv[])
{
    QApplication a(argc, argv);
    MainWindow window;      // Window definition and shown
    window.resize(1000, 700);
    window.show();
    return a.exec();
}
