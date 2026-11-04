option(WITH_LDAP "Build LDAP/AD plugin" ON)

file(GLOB plugins RELATIVE ${CMAKE_CURRENT_SOURCE_DIR} ${CMAKE_CURRENT_SOURCE_DIR}/*)

foreach(plugin ${plugins})
	if(IS_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}/${plugin})
		if(plugin STREQUAL "ldap" AND NOT WITH_LDAP)
			continue()
		endif()
		add_subdirectory(${plugin})
	endif()
endforeach()
