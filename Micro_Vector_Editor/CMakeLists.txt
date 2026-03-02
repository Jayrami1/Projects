cmake_minimum_required(VERSION 3.16)

project(assign1 VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTORCC ON)
find_package(Qt6 REQUIRED COMPONENTS Widgets)

qt_standard_project_setup()

qt_add_executable(assign1
    src/main.cpp
    src/mouseEvents_main.cpp
    src/mouseEvents_select.cpp
    src/mouseEvents_draw.cpp
    src/mouseEvents.h
    ui/mainwindow.cpp
    ui/Renderer.cpp
    ui/Toolbar.cpp
    ui/Menubar.cpp
    utils/SVGparser.cpp
    utils/SVGparser.h
    shapes/GraphicsObject.cpp
    shapes/GraphicsObject.h
    shapes/Rectangle.cpp
    shapes/Rectangle.h
    shapes/Circle.cpp
    shapes/Circle.h
    shapes/line.cpp
    shapes/line.h
    shapes/Hexagon.cpp
    shapes/Hexagon.h
    shapes/FreeHand.cpp
    shapes/FreeHand.h
    shapes/Text.cpp
    shapes/Text.h
    resources.qrc
)

target_link_libraries(assign1 PRIVATE Qt${QT_VERSION_MAJOR}::Widgets)
target_include_directories(assign1 PRIVATE 
    src ui shapes utils
)
set_target_properties(assign1 PROPERTIES
    MACOSX_BUNDLE_BUNDLE_VERSION ${PROJECT_VERSION}
    MACOSX_BUNDLE_SHORT_VERSION_STRING ${PROJECT_VERSION_MAJOR}.${PROJECT_VERSION_MINOR}
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

include(GNUInstallDirs)
install(TARGETS assign1
    BUNDLE DESTINATION .
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)
