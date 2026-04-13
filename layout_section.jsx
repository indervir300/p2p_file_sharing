              </div>
              <DarkModeToggle />
            </header>

            {/* Main content - centered when empty */}
            <div className={`flex-1 overflow-y-auto px-3 py-5 sm:px-4 lg:px-6 flex flex-col ${transfers.length === 0 ? 'justify-center' : ''}`}>
              <div className="mx-auto w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start"><div className="flex flex-col gap-5 lg:col-span-7 xl:col-span-8 w-full">

                {/* Drop Zone */}
                <FileDropZone onFilesSelect={handleFilesAttach} disabled={false} />

                {/* Send Queue */}
                {queuedTransfers.length > 0 && (
                  <div className="rounded-2xl border border-border-secondary dark:border-border-primary bg-bg-primary dark:bg-bg-secondary p-4">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
                      Queue — {queuedTransfers.length} file{queuedTransfers.length > 1 ? 's' : ''} waiting
                    </p>
                    <div className="flex flex-col gap-2">
                      {queuedTransfers.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl bg-bg-secondary dark:bg-bg-tertiary px-3 py-2.5"
                        >
                          <div className="shrink-0 rounded-lg bg-bg-tertiary dark:bg-bg-secondary p-2">
                            <svg className="h-4 w-4 text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                            <p className="text-xs text-text-secondary">{formatSize(item.size)}</p>
                          </div>
                          <button
                            onClick={() => cancelQueuedFile(item.id)}
                            className="shrink-0 rounded-full p-1.5 text-text-secondary hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active Transfers */}
                {activeTransfers.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary px-1">
                      Active Transfers
                    </p>
                    {activeTransfers.map((item) => {
                      const isMine = item.sender === 'me';
                      return (
                        <div
                          key={item.id}
                          className={`rounded-2xl border overflow-hidden transition-all ${
                            item.status === 'paused'
                              ? 'border-brand-warning/30 bg-brand-warning/5'
                              : 'border-brand-primary/20 bg-bg-primary dark:bg-bg-secondary'
                          }`}
                        >
                          <div className="flex items-center gap-3 px-4 py-3">
                            <div className={`shrink-0 rounded-xl p-2.5 ${isMine ? 'bg-brand-primary/10' : 'bg-brand-success/10'}`}>
                              <svg className={`h-5 w-5 ${isMine ? 'text-brand-primary' : 'text-brand-success'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {isMine ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                                )}
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text-primary">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-text-secondary">{formatSize(item.size)}</span>
                                <span className="text-xs text-text-secondary">·</span>
                                <span className={`text-xs font-medium ${item.status === 'paused' ? 'text-brand-warning' : 'text-brand-primary'}`}>
                                  {item.status === 'paused' ? 'Paused' : `${item.progress || 0}%`}
                                </span>
                                {item.speed > 0 && (
                                  <>
                                    <span className="text-xs text-text-secondary">·</span>
                                    <span className="text-xs text-text-secondary">{formatSpeed(item.speed)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => cancelFileTransfer(item.id)}
                              className="shrink-0 rounded-full p-1.5 text-text-secondary hover:text-brand-danger hover:bg-brand-danger/10 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          {/* Progress bar */}
                          <div className="px-4 pb-3">
                            <div className={`h-1.5 rounded-full overflow-hidden ${item.status === 'paused' ? 'bg-brand-warning/20' : 'bg-brand-primary/10'}`}>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${item.status === 'paused' ? 'bg-brand-warning' : 'bg-brand-primary'}`}
                                style={{ width: `${item.progress || 0}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                </div>
<div className="flex flex-col gap-5 lg:col-span-5 xl:col-span-4 w-full">
{/* Completed Transfers */}
{completedTransfers.length > 0 && (
<div className="flex flex-col gap-2 lg:sticky lg:top-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary px-1">
                      Completed — {completedTransfers.length} file{completedTransfers.length > 1 ? 's' : ''}
                    </p>
                    {completedTransfers.map((item) => {
                      const isMine = item.sender === 'me';
                      const isError = item.status === 'error' || item.status === 'canceled';
                      return (
                        <div
                          key={item.id}
                          className={`flex flex-col rounded-xl px-4 py-3 transition-all ${
                            isError
                              ? 'bg-brand-danger/5 border border-brand-danger/10'
                              : 'bg-bg-primary dark:bg-bg-secondary border border-border-secondary dark:border-border-primary'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`shrink-0 rounded-lg p-2 ${
                              isError ? 'bg-brand-danger/10' : isMine ? 'bg-brand-primary/10' : 'bg-brand-success/10'
                            }`}>
                              {isError ? (
                                <svg className="h-4 w-4 text-brand-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <svg className={`h-4 w-4 ${isMine ? 'text-brand-primary' : 'text-brand-success'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            
                            <div className="flex gap-2 min-w-0 flex-1">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="truncate text-sm font-medium text-text-primary">{item.name}</p>
                                  <span className="text-[10px] text-text-secondary ml-2">{formatTime(item.timestamp)}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-text-secondary">{formatSize(item.size)}</span>
                                  <span className="text-xs text-text-secondary">·</span>
                                  <span className={`text-xs font-medium ${
                                    isError ? 'text-brand-danger' : (item.status === 'paused' ? 'text-brand-warning' : (isMine ? 'text-brand-primary capitalize' : 'text-brand-success capitalize'))
                                  }`}>
                                    {item.status === 'sent' ? 'Sent ↑'
                                      : item.status === 'received' ? 'Received ↓'
                                      : item.status === 'error' ? 'Failed — Wait and retry'
                                      : item.status === 'canceled' ? 'Canceled'
                                      : item.status}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Resume or Pause actions for active transfers */}
                              {['sending', 'queued'].includes(item.status) && (
                                <button
                                  onClick={() => pauseFileTransfer(item.id)}
                                  className="shrink-0 p-2 text-brand-warning hover:bg-brand-warning/10 rounded-full transition-colors self-center"
                                  title="Pause Transfer"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                              
                              {item.status === 'paused' && item.sender === 'me' && (
                                <button
                                  onClick={() => resumeFileTransfer(item.id)}
                                  className="shrink-0 p-2 text-brand-success hover:bg-brand-success/10 rounded-full transition-colors self-center"
                                  title="Resume Transfer"
                                >
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {item.status === 'received' && item.blob && (
                              <button
                                draggable={!!item.blob}
                                onDragStart={(e) => handleDragOutStart(e, item)}
                                title="Click to download, or drag to desktop!"
                                onClick={() => downloadFile(item)}
                                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors shadow-sm cursor-grab active:cursor-grabbing ${
                                  item.downloaded
                                    ? 'bg-bg-tertiary text-text-primary hover:bg-border-secondary'
                                    : 'bg-brand-primary text-white hover:bg-brand-primary-hover'
                                }`}
                              >
                                {item.downloaded ? 'Download Again ↓' : 'Download ↓'}
                              </button>
                            )}
                          </div>
                          
                          {/* Rich Media Preview */}
                          {item.status === 'received' && item.blob && (
                            <div className="ml-11">
                               <MediaPreview blob={item.blob} mimeType={item.mimeType} name={item.name} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}


              </div>
            </div>
          </div>

          {errorMsg && (
              <div className="shrink-0 border-t border-brand-danger/20 bg-brand-danger/5 px-4 py-2 text-center text-xs text-brand-danger">
                {errorMsg}
                <button onClick={() => setErrorMsg('')} className="ml-3 underline opacity-70">
                  Dismiss
                </button>
              </div>
