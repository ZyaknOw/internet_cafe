"use client";
import { X } from "lucide-react";
export function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="overlay" onMouseDown={onClose}><section className="modal" onMouseDown={event => event.stopPropagation()}><div className="modal-title"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X /></button></div>{children}</section></div>; }
