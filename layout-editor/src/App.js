import React from "react";
import {
    Box,
    Menu,
    MenuItem,
    Stack,
    Typography
} from "@mui/material";
import GridTile from "./GridTile";
import MenuBar from "./Toolbar/MenuBar";
import PartitionPanel from "./PartitionPanel/PartitionPanel";

import iconMap from "./PartitionIcons";
import { Point } from "@cozy-caves/utils";
import Tools from "./Tools";
import useState from 'react-usestateref';

import DragAction from "./actions/dragAction";
import PenAction from "./actions/penAction";
import SelectAction from "./actions/selectAction";

import "./styles/App.css";
import "./styles/MenuBar.css";

import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import HelpDialog from "./HelpDialog";

const Layout = require("@cozy-caves/room-generation").Layout;

const App = () => {
    const gridSize = new Point(parseInt((window.innerWidth * 0.75 ) / 100), parseInt((window.innerHeight - 50 ) / 100));
    const layout = React.useRef(new Layout()).current;
    const undoStack = React.useRef([]).current;
    const redoStack = React.useRef([]).current;
    const [tileMap, setTileMap, tileMapRef] = useState({});
    const [currTool, setCurrTool, currToolRef] = useState(Tools.PEN);
    const [brushInfo, setBrushInfo] = React.useState({
        primaryBrush: "floor",
        secondaryBrush: "wall",
        fillBrush: "floor",
        defaultPartition: -1
    })
    const [mouseInfo, setMouseInfo, mouseInfoRef] = useState({
        dragButton: -1,
        selectStart: new Point(-1, -1),
        selectEnd: new Point(-1, -1),
        selectDragStart: new Point(-1, -1),
        selectDragEnd: new Point(-1, -1)
    });
    const [partitionAssigner, setPartitionAssigner, partitionAssignerRef] = useState(null);
    const [currPartition, setCurrPartition] = React.useState(null);
    const [partitionLocked, setPartitionLocked, partitionLockedRef] = useState(false);
    const [helpOpen, setHelpOpen] = React.useState(false);
    const [settingsOpen, setSettingsOpen, settingsOpenRef] = useState(false);
    const [updater, setUpdater] = React.useState(false);

    const [directoryHandle, setDirectoryHandle] = React.useState(null);
    const [directoryFiles ,setDirectoryFiles] = React.useState([]);
    const [fileHandle, setFileHandle, fileHandleRef] = useState(null);
    const [fileDisplayName, setFileDisplayName] = React.useState("Untitled Layout.json");
    const [fileEdited, setFileEdited] = React.useState(true);

    React.useEffect(() => {
        document.addEventListener("mousedown", handleMouseDown, []);
        document.addEventListener("mouseup", handleMouseUp, []);
        document.addEventListener("keydown", handleKeyPress, []);

        return () => {
            document.removeEventListener("mousedown", handleMouseDown, []);
            document.removeEventListener("mouseup", handleMouseUp, []);
            document.removeEventListener("keydown", handleKeyPress, []);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMouseDown = (e) => {
        if (typeof e.target.className !== "string" || partitionAssignerRef.current !== null) return;
        if (e.target.className && (e.target.className.includes("GridTile") || e.target.className.includes("GridTileOutline"))) return;

        if (mouseInfoRef.current.selectEnd.toString() !== "-1,-1") {
            undoStack.push(new SelectAction(mouseInfoRef.current.selectStart, mouseInfoRef.current.selectEnd));
            undoStack[undoStack.length - 1].redoSelectStart = new Point(-1, -1);
            undoStack[undoStack.length - 1].redoSelectEnd = new Point(-1, -1);

            setMouseInfo(prev => ({
                ...prev,
                selectStart: new Point(-1, -1),
                selectEnd: new Point(-1, -1)
            }));
        }
    }

    const handleMouseUp = () => {
        setMouseInfo(prev => ({ ...prev, dragButton: -1 }));

        let dragEnd = mouseInfoRef.current.selectDragEnd;
        let dragStart = mouseInfoRef.current.selectDragStart;
        let dragDiff = new Point(dragEnd.getX() - dragStart.getX(), dragEnd.getY() - dragStart.getY());
        let selectStart = mouseInfoRef.current.selectStart;
        let selectEnd = mouseInfoRef.current.selectEnd;

        if (selectStart.toString() !== "-1,-1" && selectEnd.toString() !== "-1,-1") {
            if (dragDiff.getX() !== 0 || dragDiff.getY() !== 0) {
                undoStack.push(new DragAction(selectStart, selectEnd));
                undoStack[undoStack.length - 1].redoSelectStart = selectStart.add(dragDiff);
                undoStack[undoStack.length - 1].redoSelectEnd = selectEnd.add(dragDiff);
                redoStack.splice(0, redoStack.length);

                let overlayMap = getOverlayMap();
                for (let key in overlayMap) {
                    let value = overlayMap[key];
                    let pos = new Point(parseInt(key.split(',')[0]), parseInt(key.split(',')[1]));
                    if (pos.getX() >= gridSize.getX() || pos.getY() >= gridSize.getY() || pos.getX() < 0 || pos.getY() < 0) continue;

                    undoStack[undoStack.length - 1].oldTiles.push({ pos, tile: tileMapRef.current[pos.toString()] });

                    if (value === null) {
                        layout.removeTile(pos);
                        setTileMap(prev => ({ ...prev, [pos.toString()]: undefined }));
                        undoStack[undoStack.length - 1].newTiles.push({ pos, tile: undefined });
                    } else {
                        value = value.clone(pos);
                        layout.addTile(value);
                        setTileMap(prev => ({ ...prev, [pos.toString()]: value }));
                        undoStack[undoStack.length - 1].newTiles.push({ pos, tile: value });
                    }
                }

                setMouseInfo(prev => ({
                    ...prev,
                    selectStart: prev.selectStart.add(dragDiff),
                    selectEnd: prev.selectEnd.add(dragDiff),
                    selectDragStart: new Point(-1, -1),
                    selectDragEnd: new Point(-1, -1),
                }));
            } else {
                undoStack[undoStack.length - 1].redoSelectStart = selectStart;
                undoStack[undoStack.length - 1].redoSelectEnd = selectEnd;
            }
        }
    }

    const handleKeyPress = (e) => {
        if (currToolRef.current === Tools.SELECTOR && e.key === "Delete") {
            for (let posStr in tileMapRef.current) {
                if (!tileMapRef.current[posStr]) continue;
                let pos = tileMapRef.current[posStr].getPosition();
                if (isInSelection(pos)) {
                    layout.removeTile(pos);
                    setTileMap(prev => ({ ...prev, [pos.toString()]: undefined }));
                }
            }

            setMouseInfo(prev => ({
                ...prev,
                selectStart: new Point(-1, -1),
                selectEnd: new Point(-1, -1)
            }));
        } else if (e.ctrlKey && e.key === "z") {
            if (undoStack.length === 0) return;
            setFileEdited(true);
            let action = undoStack.pop();
            action.undo(layout, setTileMap, setMouseInfo, changeTool);
            redoStack.push(action);
        } else if (e.ctrlKey && e.key === "y") {
            if (redoStack.length === 0) return;
            setFileEdited(true);
            let action = redoStack.pop();
            action.redo(layout, setTileMap, setMouseInfo, changeTool);
            undoStack.push(action);
        } else if (e.altKey && !isNaN(e.key)) {
            e.preventDefault();
            let num = e.key === "0" ? 7 : parseInt(e.key) - 3;
            if (num > layout.getPartitionDisplayInfo().length - 3 || num < -2) return;
            setBrushInfo(prev => ({ ...prev, defaultPartition: num }));
            if (num >= 0) updateActivePartition(num);
        } else if (e.altKey && e.key === "=") handleNewPartition();
        else if (e.ctrlKey && e.key === "o") {
            e.preventDefault();
            handleFileOpen();
        } else if (e.ctrlKey && e.shiftKey && e.key === "O") {
            e.preventDefault();
            handleFolderOpen();
        } else if (e.ctrlKey && e.key === "s") {
            e.preventDefault();
            handleFileSave();
        } else if (e.ctrlKey && e.shiftKey && e.key === "S") {
            e.preventDefault();
            handleFileSaveAs();
        } else if (e.shiftKey && e.key === "N") {
            e.preventDefault();
            handleNewLayout();
        } else if (e.ctrlKey && e.key === "/") {
            e.preventDefault();
            setHelpOpen(true);
        } else if (e.key === "x") {
            setBrushInfo(prev => ({
                ...prev,
                primaryBrush: prev.secondaryBrush,
                secondaryBrush: prev.primaryBrush
            }));
        } else if (e.ctrlKey && e.key === "i") setSettingsOpen(!settingsOpenRef.current);
        else if (e.key === "b") changeTool(Tools.PEN);
        else if (e.key === "e") changeTool(Tools.ERASER);
        else if (e.key === "g") changeTool(Tools.FILL);
        else if (e.key === "v") changeTool(Tools.SELECTOR);
        else if (e.key === "i") changeTool(Tools.PICKER);
    }

    const changeTool = (tool) => {
        setMouseInfo(prev => ({
            ...prev,
            selectStart: new Point(-1, -1),
            selectEnd: new Point(-1, -1)
        }));

        setCurrTool(tool);
    }

    const isInSelection = (pos, useDrag = true) => {
        let selectStart = mouseInfoRef.current.selectStart;
        let selectEnd = mouseInfoRef.current.selectEnd;
        let minX = Math.min(selectStart.getX(), selectEnd.getX());
        let maxX = Math.max(selectStart.getX(), selectEnd.getX());
        let minY = Math.min(selectStart.getY(), selectEnd.getY());
        let maxY = Math.max(selectStart.getY(), selectEnd.getY());
        let minPoint;
        let maxPoint;
        if (useDrag) {
            let dragEnd = mouseInfoRef.current.selectDragEnd;
            let dragStart = mouseInfoRef.current.selectDragStart;
            let dragDiff = new Point(dragEnd.getX() - dragStart.getX(), dragEnd.getY() - dragStart.getY());
            minPoint = new Point(minX + dragDiff.getX(), minY + dragDiff.getY());
            maxPoint = new Point(maxX + dragDiff.getX(), maxY + dragDiff.getY());
        } else {
            minPoint = new Point(minX, minY);
            maxPoint = new Point(maxX, maxY);
        }

        return minPoint.getX() <= pos.getX() && pos.getX() <= maxPoint.getX()
            && minPoint.getY() <= pos.getY() && pos.getY() <= maxPoint.getY();
    }

    const getOverlayMap = () => {
        let overlayMap = {};
        for (let posStr in tileMapRef.current) {
            if (!tileMapRef.current[posStr] || !isInSelection(tileMapRef.current[posStr].getPosition(), false)) continue;
            overlayMap[posStr] = null;
        }
        for (let posStr in tileMapRef.current) {
            if (!tileMapRef.current[posStr] || !isInSelection(tileMapRef.current[posStr].getPosition(), false)) continue;
            let pos = tileMapRef.current[posStr].getPosition();
            let dragEnd = mouseInfoRef.current.selectDragEnd;
            let dragStart = mouseInfoRef.current.selectDragStart;
            let dragDiff = new Point(dragEnd.getX() - dragStart.getX(), dragEnd.getY() - dragStart.getY());
            overlayMap[pos.add(dragDiff).toString()] = tileMapRef.current[posStr];
        }
        return overlayMap;
    }

    const handlePartitionChange = (partitionNum) => {
        setFileEdited(true);

        let action = new PenAction(false, null);
        undoStack.push(action);
        if (isInSelection(partitionAssignerRef.current.pos) && mouseInfoRef.current.selectEnd.toString() !== "-1,-1") {
            for (let key in tileMapRef.current) {
                if (!tileMapRef.current[key] || !isInSelection(tileMapRef.current[key].getPosition())) continue;
                let tile = tileMapRef.current[key];
                action.oldTiles.push({ pos: tile.getPosition(), tile, partitionNum: tile.getPartitionNum() });
                action.newTiles.push({ pos: tile.getPosition(), tile, partitionNum: partitionNum });
                tile.setPartitionNum(partitionNum);
                layout.updateTile(tile);
            }
        } else {
            let tile = tileMapRef.current[partitionAssignerRef.current.pos.toString()];
            action.oldTiles.push({ pos: partitionAssignerRef.current.pos, tile, partitionNum: tile.getPartitionNum() });
            action.newTiles.push({ pos: partitionAssignerRef.current.pos, tile, partitionNum: partitionNum });
            tile.setPartitionNum(partitionNum);
            layout.updateTile(tile);
        }

        updateActivePartition(partitionNum);

        setPartitionAssigner(null);
    }

    const handlePartitionContextMenu = (e) => {
        e.preventDefault();
        setPartitionAssigner(null);
    }

    const handleNewPartition = () => {
        setFileEdited(true);

        let partition = layout.newPartition();
        let partitionNum = layout.getPartitionDisplayInfo().length;
        partition.setPartitionName("Partition #" + partitionNum);
        setBrushInfo(prev => ({ ...prev, defaultPartition: partitionNum - 3 }));
        updateActivePartition(partitionNum - 3);

        return partitionNum - 3;
    }

    const isPartitionActiveForTile = (partitionNum) => {
        if (partitionAssigner === null) return false;
        if (mouseInfo.selectEnd.toString() !== "-1,-1") {
            for (let key in tileMap) {
                if (!tileMap[key] || !isInSelection(tileMap[key].getPosition())) continue;
                if (tileMap[key].getPartitionNum() !== partitionNum) return false;
            }
        }
        let tile = tileMap[partitionAssigner.pos.toString()];
        return tile.getPartitionNum() === partitionNum;
    }

    const updateActivePartition = (partitionNum) => {
        if (partitionNum < 0 || partitionLockedRef.current) return;
        let partition = layout.getPartition(partitionNum);
        setCurrPartition({partition, num: partitionNum});
    }

    const removePartition = () => {
        if (currPartition === null) return;

        setFileEdited(true);
        
        undoStack.splice(0, undoStack.length);
        redoStack.splice(0, redoStack.length);

        let partition = currPartition.partition;
        let partitionCount =  layout.getPartitionDisplayInfo().length;
        let nextPartitionNum = partitionCount > 3 ? 0 : -1;
        
        for (let i = currPartition.num + 1; i < partitionCount - 2; i++) {
            let currentEdit = layout.getPartition(i);
            if (!currentEdit) continue;
            Array.from(currentEdit.getTiles().values()).forEach(tile => {
                tile.setPartitionNum(i - 1);
            });
        }

        layout.removePartition(currPartition.num);

        Array.from(partition.getTiles().values()).forEach(tile => {
            tile.setPartitionNum(nextPartitionNum);
            layout.updateTile(tile);
        });

        if (brushInfo.defaultPartition === currPartition.num) setBrushInfo(prev => ({ ...prev, defaultPartition: nextPartitionNum }));
        if (nextPartitionNum === 0) setCurrPartition({partition: layout.getPartition(0), num: 0});
        else setCurrPartition(null);

        setUpdater(!updater);
    }

    const handleFileOpen = () => {
        let options = {
            types: [
                {
                    description: "JSON",
                    accept: { "application/json": [".json"] }
                }
            ]
        }

        window.showOpenFilePicker(options).then(([fh]) => loadHandle(fh)).catch(() => {});
    }

    const loadHandle = (fh) => {
        setFileHandle(fh);
        
        fh.getFile().then((file) => {
            setFileDisplayName(file.name);
            setFileEdited(false);
            return file.text();
        }).then(text => {
            undoStack.splice(0, undoStack.length);
            redoStack.splice(0, redoStack.length);

            layout.clearLayout();
            Layout.fromSerializableLayout(JSON.parse(text), layout);

            if (layout.getPartition(0)) {
                setBrushInfo(prev => ({ ...prev, defaultPartition: 0 }));
                setCurrPartition({partition: layout.getPartition(0), pos: 0}); 
            } else setBrushInfo(prev => ({ ...prev, defaultPartition: -1 }));

            let newTileMap = {};
            layout.getTiles().forEach(tile => newTileMap[tile.getPosition().toString()] = tile);
            setTileMap(newTileMap);
        });
    }

    const handleFileSave = () => {
        if (!fileHandleRef.current) handleFileSaveAs();
        else {
            fileHandleRef.current.createWritable().then((file) => {
                file.write(JSON.stringify(layout.getSerializableLayout()));
                file.close();
                setFileEdited(false);
                setFileDisplayName(fileHandleRef.current.name);
            }).catch(() => {});
        }
    }

    const handleFileSaveAs = () => {
        let options = {
            suggestedName: fileDisplayName,
            types: [
                {
                    description: "JSON",
                    accept: { "application/json": [".json"] }
                }
            ]
        };

        window.showSaveFilePicker(options).then(fh => {
            setFileHandle(fh);
            fh.createWritable().then((file) => {
                file.write(JSON.stringify(layout.getSerializableLayout()));
                file.close();
                setFileEdited(false);
                setFileDisplayName(fh.name);
                updateFileList();
            })
        }).catch(() => { });
    }

    const handleFolderOpen = () => {
        let options = {
            id: "layout-folder",
            mode: "readwrite"
        }

        window.showDirectoryPicker(options).then(dh => {
            setDirectoryHandle(dh);
            updateFileList(dh);
        }).catch(() => {});
    }

    const updateFileList = async (dh = directoryHandle) => {
        if (dh === null) return;

        let files = [];
        for await (const fileHandle of dh.values()) {
            if (fileHandle.kind === "file") {
                const file = await fileHandle.getFile();
                if (file !== null && file.type === "application/json") files.push(fileHandle);;
            }
        }
        setDirectoryFiles(files);
    }

    const handleNewLayout = () => {
        undoStack.splice(0, undoStack.length);
        redoStack.splice(0, redoStack.length);

        layout.clearLayout();
        setTileMap({});
        setCurrPartition(null);
        setBrushInfo(prev => ({ ...prev, defaultPartition: -1 }));
        setFileHandle(null);
        setFileEdited(true);
        setFileDisplayName("Untitled Layout.json");
    }

    return (
        <Box>
            <MenuBar currTool={currTool} setCurrTool={changeTool} brushInfo={brushInfo} setBrushInfo={setBrushInfo}
                layout={layout} handleNewPartition={handleNewPartition} updateActivePartition={updateActivePartition} 
                handleFileOpen={handleFileOpen} fileEdited={fileEdited} fileDisplayName={fileDisplayName} handleFileSaveAs={handleFileSaveAs} 
                handleFileSave={handleFileSave} handleNewLayout={handleNewLayout} handleFolderOpen={handleFolderOpen} directoryFiles={directoryFiles} 
                fileHandle={fileHandle} loadHandle={loadHandle} setHelpOpen={setHelpOpen} settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />

            <Box sx={{ pt: 2.5 }} id="grid">
                {[...Array(gridSize.getY())].map((x, i) =>
                    <Stack direction="row" key={i} sx={{ ml: 2, mt: "-5px" }} spacing="-5px">
                        {[...Array(gridSize.getX())].map((x, j) =>
                            <GridTile key={j} pos={new Point(j, i)} gridSize={gridSize} currTool={currTool} setCurrTool={setCurrTool} layout={layout}
                                mouseInfo={mouseInfo} setMouseInfo={setMouseInfo} brushInfo={brushInfo} setBrushInfo={setBrushInfo} undoStack={undoStack}
                                tileMap={tileMap} setTileMap={setTileMap} isInSelection={isInSelection} getOverlayMap={getOverlayMap} redoStack={redoStack}
                                partitionAssigner={partitionAssigner} setPartitionAssigner={setPartitionAssigner} setCurrPartition={updateActivePartition}
                                setFileEdited={setFileEdited}
                            />
                        )}
                    </Stack>
                )}
            </Box>

            <PartitionPanel partition={!!currPartition ? currPartition.partition : null} update={() => setUpdater(!updater)} 
                locked={partitionLocked} setLocked={setPartitionLocked} removePartition={removePartition} setFileEdited={setFileEdited} />

            <Menu open={partitionAssigner !== null} onClose={() => setPartitionAssigner(null)} anchorReference="anchorPosition"
                anchorPosition={partitionAssigner !== null ? { top: partitionAssigner.mouseY, left: partitionAssigner.mouseX } : undefined}
                onContextMenu={handlePartitionContextMenu} sx={{ "& .MuiPaper-root": { borderRadius: 0, backgroundColor: "#7d7a7a" }, mt: 1 }}
            >
                {layout.getPartitionDisplayInfo().map((info, i) =>
                    <MenuItem key={info.name + i} onClick={() => handlePartitionChange(i - 2)} className="MenuItem" sx={{ minWidth: 140 }} disableRipple>
                        <Box sx={{ color: info.color, mt: 1 }}> {iconMap[info.icon]} </Box>
                        <Typography sx={{ ml: 1.2, mr: 2, mt: 0.5 }}> {info.name} </Typography>
                        {isPartitionActiveForTile(i - 2) && <CheckIcon />}
                    </MenuItem>
                )}
                <MenuItem onClick={() => handlePartitionChange(handleNewPartition())} className="MenuItem" sx={{ minWidth: 140, py: "4px !important" }} disableRipple>
                    <AddIcon />
                    <Typography sx={{ ml: 1.2, mr: 2, mt: 0.4 }}> Create new partition </Typography>
                </MenuItem>
            </Menu>

            <HelpDialog open={helpOpen} setOpen={setHelpOpen} />
        </Box>
    );
}

export default App;
