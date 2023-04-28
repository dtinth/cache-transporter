# cache-transporter

:construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction: :construction:  [WIP] Transports CI cache to/from a `docker build` process

This little hackery should let you achieve granular caching when building Docker image… While Docker’s built-in caching mechanism operates at a layer level (“layer caching”), many build tools can perform “granular caching” at a file-level. For example, in a big project, each source file may be compiled into intermediate files (e.g. object files) before being linked/bundled into a final build product. It is often the case that the compilation phase, rather than the bundling phase, takes the most time.

- **Without granular caching**, if you change a single file, you have to recompile everything.
- **With granular caching**, if you change a single file, you only have to recompile that file.
