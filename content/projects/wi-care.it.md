# Wi-Care

## Il problema

In una casa di riposo una caduta di notte può restare inosservata per ore. Una telecamera la vedrebbe, ma nessuno vuole una telecamera in camera da letto. Wi-Care usa invece un radar a onde millimetriche (mmWave): vede le persone come una nuvola di punti in movimento, mai come un'immagine, quindi funziona al buio, attraverso le coperte e senza riprendere nessuno. Da quei punti riconosce cosa sta facendo l'ospite (camminare, sedersi, sdraiarsi a letto o a terra, alzarsi, chinarsi) e dà l'allarme quando qualcuno cade e non si rialza.

## Il mio ruolo

Ho co-fondato Wi-Care e ne guido la parte tecnica. Ho progettato e scritto tutto il percorso dei dati, dal flusso live del sensore all'allarme: come si registrano e si conservano le registrazioni, come diventano dataset, come i modelli vengono addestrati e valutati, e come la stessa catena gira dal vivo.

## Il percorso dei dati

1. **Acquisizione.** Il radar manda pacchetti binari su una linea seriale. Un thread di lettura li decodifica in frame e li passa all'elaborazione attraverso una coda, così l'acquisizione non aspetta mai il modello; ogni frame viene allineato al precedente e portato nelle coordinate della stanza.
2. **Etichettatura.** Le registrazioni si etichettano mentre si fanno: un'attività alla volta, oppure sessioni lunghe in cui si vive normalmente nella stanza segnando con un tasto cosa si sta facendo.
3. **Conservazione.** Ogni registrazione finisce in un archivio di file immutabili e compressi ed è descritta in un catalogo.
4. **Dataset.** È il catalogo a decidere cosa entra in un dataset; i frame diventano finestre di feature calcolate sui punti della persona.
5. **Addestramento e valutazione.** Più modelli vengono addestrati e confrontati sulle stesse finestre e sulle stesse registrazioni di test.
6. **Inferenza dal vivo.** Il modello addestrato e lo strato di decisioni sopra di lui girano sul flusso live, o su qualsiasi registrazione riprodotta come se fosse dal vivo.

## Le scelte di cui vado fiero

**Dati di cui ci si può fidare.** Un file dell'archivio viene scritto una volta sola, intero, e poi rinominato, mai sovrascritto; il suo checksum è nel catalogo, e un solo comando controlla ogni file. Il catalogo (SQLite) conosce ogni registrazione, la configurazione del radar con cui è stata fatta, i suoi marcatori, perché una registrazione è stata scartata, e su quali registrazioni ogni modello è stato addestrato e testato: ogni risultato si può ricondurre ai suoi dati.

**Generazioni di dataset.** Quando cambia l'installazione del sensore, i dati iniziano una nuova generazione, così registrazioni fatte con geometrie diverse non si mescolano mai nell'addestramento.

**Un test set che non si sposta.** Le registrazioni vengono assegnate a training o test nel momento in cui si salvano, per registrazione e non per finestra (le finestre di una stessa registrazione si sovrappongono, dividerle porterebbe il test dentro il training). I dati nuovi non cambiano mai il test, quindi i risultati restano confrontabili nel tempo.

**Sessioni lunghe a pezzi.** Una sessione di ore viene scritta come una sequenza di parti, ognuna registrata nel catalogo appena è su disco: niente resta tutto in memoria, e un crash perde al massimo gli ultimi minuti.

**Lo stesso codice in addestramento e dal vivo.** Feature e normalizzazione hanno un'unica implementazione, e il file del modello porta con sé tutto ciò con cui è stato addestrato (scaler, calibrazione, classi). Se la calibrazione cambia dopo l'addestramento, l'esecuzione live lo segnala: il classico scarto tra addestramento ed esecuzione in produzione è chiuso per costruzione.

**Replay.** Un'esecuzione live si può registrare con tutti gli stati attraversati; ogni errore visto dal vivo si può riprodurre in seguito, con lo stesso modello o con uno più nuovo, e misurare.

**Numeri onesti.** Ogni registrazione è valutata da un modello che non l'ha mai vista in addestramento; le decisioni sopra il modello sono tarate sui dati invece che a mano, mettendo al primo posto le cadute mancate, poi i falsi allarmi all'ora, poi il ritardo dell'allarme.

## I modelli

Il radar vede solo ciò che si muove, quindi il sistema lavora su due livelli: un modello temporale classifica il movimento in una finestra scorrevole di pochi secondi, e una macchina a stati tiene la postura della persona tra un movimento e l'altro, conferma una caduta e decide quando chiedere aiuto. Ho confrontato reti ricorrenti e convoluzionali con un modello di base a gradient boosting, scegliendo con una ricerca in cross-validation divisa per registrazione.

## A che punto è

Tutto il ciclo funziona dall'inizio alla fine, dal radar all'allarme, in una prima versione. Wi-Care è stata selezionata tra le 10 migliori idee d'impresa della Start Cup Veneto 2026 e si sta preparando per il Premio Nazionale per l'Innovazione. I prossimi passi: dati da più persone e più stanze, e lunghe prove dal vivo per misurare cadute mancate e falsi allarmi.

Il codice è privato: appartiene alla start-up. Ne parlo volentieri in un colloquio.
