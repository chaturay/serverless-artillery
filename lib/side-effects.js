const BbPromise = require('bluebird')
const fs = BbPromise.promisifyAll(require('fs'))
const os = require('os')
const shortid = require('shortid')
const { exec } = require('child_process')
const path = require('path')
const { freeze } = require('./fp')

const errToNpmErr = ({ code, signal }) =>
  Object.assign(new Error('Failed to npm install.'), { code, signal })

module.exports = freeze({

  log: (...args) =>
    console.log(...args.map(arg => (arg && arg.join ? arg.join(os.EOL) : arg))),

  writeFileIfNotExists: (fileName, data) => new Promise((resolve, reject) =>
    fs.writeFile(fileName, data, { flag: 'wx' }, err =>
      (err
        ? err.code === 'EEXIST' ? resolve(false) : reject(err)
        : resolve(true)))),

  readLocalFile: (...fileNames) => new Promise((resolve, reject) =>
    fs.readFile(path.join(__dirname, ...fileNames), (err, data) =>
      (err ? reject(err) : resolve(data.toString())))),

  deleteFile: fileName => new Promise((resolve, reject) =>
    fs.unlink(fileName, err =>
      (err ? reject(err) : resolve()))),

  randomId: () => shortid.generate().replace('_', '-'),

  npmInstall: () => new Promise((resolve, reject) => {
    const execCallback = (err, stdout, stderr) => (err
      ? reject(errToNpmErr(err))
      : resolve({ stdout, stderr }))
    return exec('npm install', execCallback)
  }),

})
