var express = require("express");
var router = express.Router();

let formidable = require("formidable");
let fs = require("fs-extra");
let path = require("path");
let concat = require("concat-files");
let opn = require("opn");

let uploadDir = "./public/nodeServer/uploads";

// 处理静态资源
// router.use(express.static(path.join(__dirname)))

// 检查文件的MD5
router.get("/check/file", (req, resp) => {
  let query = req.query;
  let fileName = query.fileName;
  let fileMd5Value = query.fileMd5Value;
  // 获取文件Chunk列表
  getChunkList(
    path.join(uploadDir, fileName),
    path.join(uploadDir, fileMd5Value),
    data => {
      resp.send(data);
    }
  );
});
var filePath = path.resolve(__dirname, "../", "nodeServer/uploads");
var filePath11 = path.resolve(__dirname, "../", "./public/nodeServer/uploads");
console.log(
  "-----------------------filePath-----------------------",
  filePath11
);
router.get("/download", function(req, res, next) {
  var downId = req.query.downId;

  // res.download(filePath + "/" + downId);
});

// 查找文件夹
router.get("/wenjian", function(req, resp) {
  var getFiles = {
    //获取文件夹下的所有文件
    getFileList: function(path) {
      var filesList = [];
      readFileList(filePath11, filesList);
      return filesList;
    }
  };

  function readFileList(path, filesList) {
    var files = fs.readdirSync(path);
    files.forEach(function(itm, index) {
      var stat = fs.statSync(path + "/" + itm);
      if (stat.isDirectory()) {
        //递归读取文件
        // readFileList(path + itm + "/", filesList)
      } else {
        var obj = {}; //定义一个对象存放文件的路径和名字
        obj.path = path; //路径
        obj.filename = itm; //名字
        obj.file = path + "\\" + itm; //名字
        filesList.push(obj);
      }
    });
  }
  resp.send(getFiles.getFileList(filePath));
});
// 检查chunk的MD5
router.get("/check/chunk", (req, resp) => {
  let query = req.query;
  let chunkIndex = query.index;
  let md5 = query.md5;

  fs.stat(path.join(uploadDir, md5, chunkIndex), (err, stats) => {
    if (stats) {
      resp.send({
        stat: 1,
        exit: true,
        desc: "Exit 1"
      });
    } else {
      resp.send({
        stat: 1,
        exit: false,
        desc: "Exit 0"
      });
    }
  });
});

router.all("/merge", (req, resp) => {
  let query = req.query;
  let md5 = query.md5;
  let size = query.size;
  let fileName = query.fileName;
  mergeFiles(path.join(uploadDir, md5), uploadDir, fileName, size);
  resp.send({
    stat: 1
  });
});

router.post("/upload", (req, resp) => {
  var form = new formidable.IncomingForm({
    uploadDir: "nodeServer/tmp"
  });
  form.parse(req, function(err, fields, file) {
    let index = fields.index;
    let total = fields.total;
    let fileMd5Value = fields.fileMd5Value;
    let folder = path.resolve(
      __dirname,
      "../",
      "nodeServer/uploads",
      fileMd5Value
    );
    folderIsExit(folder).then(val => {
      let destFile = path.resolve(folder, fields.index);
      console.log("----------->", file.data.path, destFile);
      copyFile(file.data.path, destFile).then(
        successLog => {
          resp.send({
            stat: 1,
            desc: index
          });
        },
        errorLog => {
          resp.send({
            stat: 0,
            desc: "Error"
          });
        }
      );
    });
  });
  // 文件夹是否存在, 不存在则创建文件
  function folderIsExit(folder) {
    console.log("folderIsExit", folder);
    return new Promise(async (resolve, reject) => {
      let result = await fs.ensureDirSync(path.join(folder));
      console.log("result----", result);
      resolve(true);
    });
  }
  // 把文件从一个目录拷贝到别一个目录
  function copyFile(src, dest) {
    let promise = new Promise((resolve, reject) => {
      fs.rename(src, dest, err => {
        if (err) {
          reject(err);
        } else {
          resolve("copy file:" + dest + " success!");
        }
      });
    });
    return promise;
  }
});

// 获取文件Chunk列表
async function getChunkList(filePath, folderPath, callback) {
  let isFileExit = await isExist(filePath);
  let result = {};
  // 如果文件(文件名, 如:node-v7.7.4.pkg)已在存在, 不用再继续上传, 真接秒传
  if (isFileExit) {
    result = {
      stat: 1,
      file: {
        isExist: true,
        name: filePath
      },
      desc: "file is exist"
    };
  } else {
    let isFolderExist = await isExist(folderPath);
    console.log(folderPath);
    // 如果文件夹(md5值后的文件)存在, 就获取已经上传的块
    let fileList = [];
    if (isFolderExist) {
      fileList = await listDir(folderPath);
    }
    result = {
      stat: 1,
      chunkList: fileList,
      desc: "folder list"
    };
  }
  callback(result);
}

// 文件或文件夹是否存在
function isExist(filePath) {
  return new Promise((resolve, reject) => {
    fs.stat(filePath, (err, stats) => {
      // 文件不存在
      if (err && err.code === "ENOENT") {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// 列出文件夹下所有文件
function listDir(path) {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      // 把mac系统下的临时文件去掉
      if (data && data.length > 0 && data[0] === ".DS_Store") {
        data.splice(0, 1);
      }
      resolve(data);
    });
  });
}
// 合并文件
async function mergeFiles(srcDir, targetDir, newFileName, size) {
  console.log(...arguments);
  let targetStream = fs.createWriteStream(path.join(targetDir, newFileName));
  let fileArr = await listDir(srcDir);
  // 把文件名加上文件夹的前缀
  for (let i = 0; i < fileArr.length; i++) {
    fileArr[i] = srcDir + "/" + fileArr[i];
  }
  console.log(fileArr);
  concat(fileArr, path.join(targetDir, newFileName), () => {
    console.log("Merge Success!");
  });
}
module.exports = router;
