const { promisify } = require('util')
const fs = require('fs')
const renameAsync = promisify(fs.rename)
const readdirp = require('readdirp')
const { transliterate } = require('transliteration')
const inquirer = require('inquirer')

transliterate.config({ replace: [["'", ""]] })

const args = process.argv.splice(2)
const initialPath = args[0]
let dryRun = true

function getDirectories(path, depth=0) {
  return new Promise((resolve, reject) => {
    readdirp(
      { root: path, depth },
      function(fileInfo) {}, 
      function (err, res) {
        if (err) return reject(err)
        resolve(res.directories.map((dirObj) => dirObj.fullPath))
      }
    )
  })
}

function getFilesAndDirectories(path, depth=0) {
  return new Promise((resolve, reject) => {
    readdirp(
      { root: path, depth },
      function(fileInfo) {}, 
      function (err, res) {
        if (err) return reject(err)
        const allItems = [
          ...res.directories.map((dirObj) => dirObj.fullPath),
          ...res.files.map((fileObj) => fileObj.fullPath)
        ]
        resolve(allItems)
      }
    )
  })
}

function getTransliteratedNames(names) {
  return names
  .map((name) => {
    const newName = transliterate(name)
    if (newName!==name) return {
      originalName: name,
      newName
    }
    return null
  })
  .filter((name) => {
    return name !== null
  })
}

async function stepIntoDirectories(path) {
  let filesAndDirs
  try {
    filesAndDirs = await getFilesAndDirectories(path)
  } catch(err){
    console.error(`Failed to read with "getFilesAndDirectories", path: ${path}, error: ${err}`)
  }
  
  // Get transliteraded names
  let transliteratedNames = getTransliteratedNames(filesAndDirs)
  
  // Rename
  if (transliteratedNames.length > 0){
    transliteratedNames.forEach(async ({originalName, newName}) => {
      try {
        console.log(">>", newName)
        if (!dryRun) await renameAsync(originalName, newName)
      } catch(err){
        console.error(`Failed to rename file: "${newName}", Error: ${err}`)
      }
    })
    console.log('')
  }
  
  // Updates directory list since it could be renamed
  let dirs
  try {
    dirs = await getDirectories(path)
  } catch (err) {
    console.error(`Failed to read with "getDirectories", path: ${path}, error: ${err}`)
  }

  // Recursion
  if (dirs.length > 0){
    // console.log(dirs)
    dirs.forEach(async (dir) => {
      try {
        await stepIntoDirectories(dir)
      } catch (err) {
        console.error(`Failed "stepIntoDirectories", dir: ${dir}, error: ${err}`)
      }
    })
  }
}

async function processAll() {
  await stepIntoDirectories(initialPath)
}

function start() {
  const OPT_DRY_RUN = 'Test run'
  const OPT_RENAME = 'Rename files'

  let questions = []
  questions.push({
    type:"list", 
    name:"operationType", 
    message:'Start "test run" or begin renaming files', 
    choices:[OPT_DRY_RUN, OPT_RENAME]
  })

  inquirer
  .prompt(questions)
  .then((answers) => {
    dryRun = answers.operationType === OPT_DRY_RUN
    console.log("dryRun", dryRun)
    console.log("")

    processAll()
  })
}

start()