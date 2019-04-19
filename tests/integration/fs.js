const fs = require('fs')
const {
  join,
  basename,
  sep,
  isAbsolute,
} = require('path')

const flatten = values =>
  values.reduce((flattened, value) =>
    (Array.isArray(value)
      ? flattened.concat(flatten(value))
      : flattened.concat([value])), [])

const joinFirstTwo = parts =>
  [join(parts[0] || sep, parts[1]), ...parts.slice(2)]

const splitPath = path =>
  (isAbsolute(path)
    ? joinFirstTwo(path.split(sep))
    : path.split(sep))

const joinToLast = (list, value) =>
  (list.length
    ? join(list[list.length - 1], value)
    : value)

const progressivePaths = path =>
  splitPath(path).reduce(
    (list, part) => [...list, joinToLast(list, part)],
    []
  )

const sourceFileNameTo = destination =>
  sourceFileName =>
    join(destination, basename(sourceFileName))

const pure = {
  mkdir: (mkdir = fs.mkdir) =>
    directory =>
      new Promise(resolve => mkdir(directory, resolve)),

  mkdirp: (mkdir = pure.mkdir()) =>
    directory =>
      progressivePaths(directory)
        .reduce(
          (awaiting, nextPath) => awaiting
            .then(() => mkdir(nextPath)),
          Promise.resolve()
        ),

  ls: (readdir = fs.readdir) =>
    directory =>
      new Promise(resolve =>
        readdir(directory, (ignoredError, names) =>
          resolve(names || []))),

  listAbsolutePathsRecursively: (ls = pure.ls()) => {
    const listNext = directory =>
      ls(directory)
        .then(files => files.map(file => join(directory, file)))
        .then(files => Promise.all(files.map(listNext)))
        .then(children => [...flatten(children), directory])
    return listNext
  },

  cp: (copyFile = fs.copyFile) =>
    destination =>
      source =>
        new Promise(resolve => copyFile(source, destination, resolve)),

  copyTofolder: (cp = pure.cp()) =>
    (destination) => {
      const toDestination = sourceFileNameTo(destination)
      return filePath =>
        cp(toDestination(filePath))(filePath)
    },

  copyAll: (copyTofolder = pure.copyTofolder()) =>
    destination =>
      sourceFiles =>
        Promise.all(sourceFiles.map(copyTofolder(destination))),

  writeFile: (writeFile = fs.writeFile) =>
    destination =>
      data =>
        new Promise((resolve, reject) =>
          writeFile(destination, data, err =>
            (err
              ? reject(err)
              : resolve()))),

  readFile: (readFile = fs.readFile) =>
    destination =>
      new Promise((resolve, reject) =>
        readFile(destination, (err, data) =>
          (err
            ? reject(err)
            : resolve(data.toString())))),

  rm: (unlink = fs.unlink) =>
    path =>
      new Promise(resolve =>
        unlink(path, resolve)),

  rmdir: (rmdir = fs.rmdir) =>
    path =>
      new Promise(resolve =>
        rmdir(path, resolve)),

  rmAny: (rm = pure.rm(), rmdir = pure.rmdir()) =>
    path =>
      rm(path).then(err => (err ? rmdir(path) : undefined)),

  rmrf: (
    listAll = pure.listAbsolutePathsRecursively(),
    rm = pure.rmAny()
  ) =>
    directory =>
      listAll(directory)
        .then(files => [...files, directory])
        .then(files => Promise.all(files.map(rm))),
}

module.exports = Object.assign(
  {},
  { pure },
  Object.keys(pure).reduce(
    (resolved, key) =>
      Object.assign(resolved, { [key]: pure[key]() }),
    {}
  )
)
