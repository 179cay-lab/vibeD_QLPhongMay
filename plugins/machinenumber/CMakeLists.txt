include(BuildVeyonPlugin)

build_veyon_plugin(machinenumber
	SOURCES
	MachineNumberFeaturePlugin.cpp
	MachineNumberFeaturePlugin.h
	)

# dùng cấu hình danh bạ tích hợp (BuiltinDirectoryConfiguration.h) để đổi tên máy
target_include_directories(machinenumber PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../builtindirectory)
