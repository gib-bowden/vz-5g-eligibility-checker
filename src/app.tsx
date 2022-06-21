import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { DialogEvents } from "./events";
import "./index.css";
import { processFile } from "./processor";

const root = ReactDOM.createRoot(document.getElementById("root"));

const App = () => {
  const [status, setStatus] = useState<"processing" | "complete" | "error">();
  const handleSelectFile = async (): Promise<void> => {
    // if (!files?.length) return;
    setStatus("processing");
    window.ipcRenderer.send(DialogEvents.selectFileListen);
    // ipcRenderer.send(selectFileListen);

    // await processFile(files[0].path);
    setStatus("complete");
  };
  console.log(window);
  return (
    <div className="App">
      <header className="App-header">
        <div>
          <button onClick={handleSelectFile}>Select File</button>
          {status === "processing" && <p>Processing...</p>}
          {status === "complete" && <p>Done</p>}
        </div>
      </header>
    </div>
  );
};
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
