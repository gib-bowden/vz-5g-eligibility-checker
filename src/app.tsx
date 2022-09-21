import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import { DialogEvents } from "./events";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));

const App = () => {
  const [status, setStatus] = useState<"processing" | "complete" | "error">();
  const handleSelectFile = async (): Promise<void> => {
    setStatus("processing");
    window.ipcRenderer.send(DialogEvents.selectFileListen);
    window.ipcRenderer.on(DialogEvents.selectFileReply, (event, arg) => {
      setStatus("complete");
    });

    // await processFile(files[0].path);
  };
  return (
    <div className="App">
      <header className="App-header">
        <div>
          <button onClick={handleSelectFile}>Select File</button>
          {/* {status === "processing" && <p>Processing...</p>}
          {status === "complete" && <p>Done</p>} */}
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
