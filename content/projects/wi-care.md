# Wi-Care

## The problem

In a retirement house a fall at night can go unnoticed for hours. Cameras would see it, but nobody wants a camera in their bedroom. Wi-Care uses a mmWave radar instead: it sees people as a cloud of moving points, never as an image, so it works in the dark, through the bedding and without filming anyone. From those points it recognises what the guest is doing (walking, sitting down, lying down in bed or on the floor, getting up, bending) and raises an alarm when someone falls and does not get up.

## My role

I co-founded Wi-Care and lead its technical side. I designed and wrote the whole data path, from the sensor's live stream to the alarm: how recordings are made and kept, how they become datasets, how models are trained and judged, and how the same chain runs live.

## The data path

1. **Acquisition.** The radar sends binary packets over a serial link. A reader thread parses them into frames and hands them to the processing through a queue, so acquisition never waits for the model; every frame is aligned with the previous one and brought into room coordinates.
2. **Labelling.** Recordings are labelled while they are made, either one activity at a time or as long sessions with markers pressed while living normally in the room.
3. **Storage.** Every recording goes to an archive of immutable, compressed files and is described in a catalog.
4. **Datasets.** The catalog decides what goes into a dataset; the frames become windows of features computed on the person's points.
5. **Training and evaluation.** Several models are trained and compared on the same windows and the same test recordings.
6. **Live inference.** The trained model and a layer of decisions above it run on the live stream, or on any recording replayed as if it were live.

## Choices I am proud of

**Data that can be trusted.** A file in the archive is written once, whole, and then renamed, never overwritten; its checksum is in the catalog, and a single command checks every file against it. The catalog (SQLite) knows every recording, its radar configuration, its markers, why a recording was rejected, and which recordings every model was trained and tested on: any result can be traced back to its data.

**Dataset generations.** When the sensor's setup changes, the data start a new generation, so recordings made with different geometries are never mixed in training.

**A test set that does not move.** Recordings are split into training and test when they are saved, by recording and not by window (windows of one recording overlap, so splitting them would leak the test into training). New data never change the test, so results stay comparable over months.

**Long sessions in parts.** A session of hours is written as a sequence of parts, each catalogued as soon as it is on disk: nothing sits whole in memory and a crash loses at most the last few minutes.

**The same code for training and live.** Features and normalisation come from one implementation, and the model file carries everything it was trained with (scaler, calibration, classes). If the calibration changes after training, the live run warns about it: the classic gap between training and serving is closed by design.

**Replay.** A live run can be recorded with every state it went through; any mistake seen live can be replayed later, through the same model or a newer one, and measured.

**Honest numbers.** Every recording is judged by a model that never saw it in training; the decisions above the model are tuned on data instead of by hand, ranking first the falls missed, then the false alarms per hour, then the delay of the alarm.

## Modelling

The radar only sees what moves, so the system works in two layers: a temporal model classifies the movement in a sliding window of a few seconds, and a state machine keeps the person's posture between movements, confirms a fall and decides when to call for help. I compared recurrent and convolutional networks with a gradient-boosted baseline, choosing among them with a cross-validated search split by recording.

## Where it is now

The whole loop works end to end, from the radar to the alarm, as a first version. Wi-Care was selected among the Top 10 business ideas of Start Cup Veneto 2026 and is preparing for the National Innovation Award. Next comes data from more people and rooms, and long live trials to measure missed falls and false alarms.

The code is private: it belongs to the start-up. I am happy to talk about it in an interview.
