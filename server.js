const express = require("express");
const cors = require("cors"); //import the cors package
const fs = require("fs");

const app = express();
const port = 3000;

//Middleware
app.use(cors()); // enable cors for all routes
app.use(express.json()); //translate react request/response to json

//Top level code to read from files to get data
let task_data = JSON.parse(fs.readFileSync(`${__dirname}/files/tasks.json`));

//Check tasks, using 'Get'
app.get("/api/tasks", (req, res) => {
  res.status(200).send(task_data);
});

//Create taks, using 'Post'
app.post("/api/tasks", (req, res) => {
  //const new_tasks = task_data.push(req.body); (push does not return the new array, it only return the length of the new array)
  task_data.push(req.body);

  //save the whole array back as String
  fs.writeFile(
    `${__dirname}/files/tasks.json`,
    JSON.stringify(task_data),
    (e) => {
      if (e) {
        return res.status(500).send("Error saving tasks");
      }
      res
        .status(200)
        .json({ meassage: "Successfully Added the task", data: req.body });
    },
  );
});

//Update tasks, using 'Patch'
app.patch("/api/tasks/:id", (req, res) => {
  //use the id here to make server stateless
  const id = Number(req.params.id);
  const index = task_data.findIndex((task) => {
    return task.id === id;
  });
  if (index === -1) {
    return res.status(404).json({ message: "task is not found" });
  }
  task_data[index] = { ...task_data[index], ...req.body, id: id };

  fs.writeFile(
    `${__dirname}/files/tasks.json`,
    JSON.stringify(task_data),
    (e) => {
      if (e) {
        return res.status(500).send("Error saving tasks");
      }
      res.status(200).json({
        message: "Successfully Updated the task",
        data: task_data[index],
      });
    },
  );
});

//Delete tasks, using 'Delete'
app.delete("/api/tasks/:id", (req, res) => {
  const id = Number(req.params.id);

  //create a new array using the filter methond
  const temp_task = task_data.filter((task) => {
    return task.id !== id;
  });

  //   const index = task_data.findIndex((task) => {
  //     return task.id === id;
  //   });
  if (temp_task.length === task_data.length) {
    return res.status(404).json({ message: "Task to delete not existed" });
  }
  //const temp_data = task_data[index];
  task_data = temp_task;
  fs.writeFile(
    `${__dirname}/files/tasks.json`,
    JSON.stringify(task_data),
    (e) => {
      if (e) {
        return res.status(500).send("Error saving the deletion to file");
      }
      res
        .status(200)
        .json({ message: "Successfully Delete the task", data: task_data });
    },
  );
});

app.listen(port, () => {
  console.log(`App is running on ${port}`);
});
