# Third-party runtime components

Lightem's private runtime includes unmodified or path-relocated components from
Apache Friends XAMPP 8.2.4-0. XAMPP itself and its Manager are not installed.
macOS dylib load paths and ad-hoc signatures are rewritten for independent
loading. The individual component license notices are included in `licenses/`.

* PHP 8.2.4: https://www.php.net/releases/8_2_4.php
  Source: https://www.php.net/distributions/php-8.2.4.tar.xz
  License: PHP License 3.01.
* Apache HTTP Server 2.4.56: https://archive.apache.org/dist/httpd/
  Source: https://archive.apache.org/dist/httpd/httpd-2.4.56.tar.bz2
  License: Apache License 2.0.
* MariaDB 10.4.28: https://archive.mariadb.org/mariadb-10.4.28/
  Source: https://archive.mariadb.org/mariadb-10.4.28/source/mariadb-10.4.28.tar.gz
  License: GPL version 2, with original accompanying notices.
* Apache Friends packaging/build definitions:
  https://github.com/ApacheFriends/xampp-build
  Windows binary input:
  https://sourceforge.net/projects/xampp/files/XAMPP%20Windows/8.2.4/xampp-portable-windows-x64-8.2.4-0-VS16.7z
  macOS binary source edition:
  https://sourceforge.net/projects/xampp/files/XAMPP%20Mac%20OS%20X/8.2.4/

Included dependency notices cover APR/APR-util, OpenSSL, PCRE, zlib, libzip,
libcurl, libpng, libjpeg, FreeType, libxml, LDAP, libpq and other transitively
linked libraries. Only dependency binaries used by the selected executables
and modules are copied on macOS. The prepared manifest inventories every file.
